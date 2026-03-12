import { Router } from "express";
import { resolveConversationForInbound, saveInboundMessage, updateMessageStatus, saveOutboundMessage } from "../services/conversation.js";
import { loadConnector, verifyWebhookSignature } from "../utils.js";
import { webhookLimiter } from "../middleware/rateLimiter.js";
import { emitConversationEvent } from "../services/socketService.js";
import { isWithinBusinessHours, getOffHoursMessage } from "../services/businessHoursService.js";
import { listQueues, distributeConversation } from "../services/queue.js";
import { logger } from "../lib/logger.js";
import { writeAuditLog } from "../services/auditLog.js";

const router = Router();
router.use(webhookLimiter);

router.post("/whatsapp/:provider/:connectorId/*", async (req, res, next) => {
    try {
        const provider = String(req.params.provider).toLowerCase();
        const connectorId = req.params.connectorId;

        const connector = await loadConnector(connectorId);

        // Security: Webhook Signature Verification
        if (connector.WebhookSecret) {
            const sig = req.headers["x-h-signature"] || req.headers["x-hub-signature-256"];
            const isValid = verifyWebhookSignature(
                (req as any).rawBody,
                connector.WebhookSecret,
                String(sig || ""),
                provider
            );
            if (!isValid) {
                logger.warn(
                    { connectorId, provider, requestId: (req as any).requestId, ip: req.ip },
                    "[Webhook] Invalid signature — unauthorized attempt"
                );
                await writeAuditLog({
                    action: "WEBHOOK_INVALID_SIGNATURE",
                    ipAddress: req.ip,
                    afterValues: { connectorId, provider }
                });
                return res.status(401).json({ error: "Unauthorized: Invalid Signature" });
            }
        }
        const adapters = req.app.get("adapters");
        const adapter = adapters[provider];

        if (!adapter) return res.status(404).send("Unknown provider");

        logger.info(
            { provider, connectorId, eventType: req.body?.EventType, requestId: (req as any).requestId },
            "[Webhook] Event received"
        );

        // Auto-update connector baseUrl from GTI webhook payload
        if (req.body?.BaseUrl && connector.ConfigJson) {
            try {
                const cfg = JSON.parse(connector.ConfigJson);
                const incomingBase = req.body.BaseUrl.replace(/\/$/, '');
                if (cfg.baseUrl !== incomingBase) {
                    cfg.baseUrl = incomingBase;
                    const newConfig = JSON.stringify(cfg);
                    const pool = await (await import('../db.js')).getPool();
                    await pool.request()
                        .input('connectorId', connectorId)
                        .input('configJson', newConfig)
                        .query('UPDATE altdesk.ChannelConnector SET ConfigJson = @configJson WHERE ConnectorId = @connectorId');
                    connector.ConfigJson = newConfig;
                    logger.info({ connectorId, newBaseUrl: incomingBase }, "[Webhook] Auto-updated connector baseUrl");
                }
            } catch (e) { /* ignore config parse errors */ }
        }

        // 1. Try status update (messages_update → delivered/read)
        if (adapter.parseStatusUpdate) {
            const statusUpdate = adapter.parseStatusUpdate(req.body, connector);
            if (statusUpdate) {
                const conversationId = await updateMessageStatus(
                    statusUpdate.tenantId,
                    statusUpdate.externalMessageId,
                    statusUpdate.status
                );

                const io = req.app.get("io");
                if (io && conversationId) {
                    emitConversationEvent(io, statusUpdate.tenantId, conversationId, "message:status", {
                        conversationId,
                        externalMessageId: statusUpdate.externalMessageId,
                        status: statusUpdate.status
                    });
                }

                return res.status(200).json({ ok: true, statusUpdate: statusUpdate.status });
            }
        }

        // 2. Try inbound message (messages → new message)
        const inbound = adapter.parseInbound(req.body, connector);
        if (!inbound) return res.status(200).send("ignored");

        const conversationId = await resolveConversationForInbound(inbound, connector.ConnectorId, connector.ChannelId);
        await saveInboundMessage(inbound, conversationId);

        // --- Business Hours Check ---
        const withinHours = await isWithinBusinessHours(inbound.tenantId);
        if (!withinHours) {
            const offMsg = await getOffHoursMessage(inbound.tenantId);
            if (offMsg) {
                try {
                    const fetchConn = { ConnectorId: connector.ConnectorId, Provider: connector.Provider, ConfigJson: connector.ConfigJson };
                    await adapter.sendText(fetchConn, inbound.externalUserId, offMsg);
                    await saveOutboundMessage(inbound.tenantId, conversationId, offMsg);
                } catch (err) {
                    logger.error({ err, conversationId, tenantId: inbound.tenantId }, "[BusinessHours] Error sending off-hours message");
                }
            }
        }
        // --- End Business Hours Check ---

        const io = req.app.get("io");

        // Emite evento de nova mensagem para o frontend
        if (io) {
            emitConversationEvent(io, inbound.tenantId, conversationId, "message:new", {
                conversationId,
                senderExternalId: inbound.externalUserId,
                text: inbound.text ?? `[${inbound.mediaType}]`,
                mediaType: inbound.mediaType,
                mediaUrl: inbound.mediaUrl,
                direction: "IN"
            });

            emitConversationEvent(io, inbound.tenantId, conversationId, "conversation:updated", {
                conversationId,
                lastMessage: inbound.text ?? `[${inbound.mediaType}]`,
                direction: "IN",
                timestamp: new Date().toISOString()
            });
        }

        // Distribuição automática para fila de atendimento humano (se conversa sem atendente)
        try {
            const queues = await listQueues(inbound.tenantId);
            const targetQueue = queues[0]?.QueueId;
            if (targetQueue) {
                const assignedTo = await distributeConversation(inbound.tenantId, conversationId, targetQueue);
                if (assignedTo && io) {
                    emitConversationEvent(io, inbound.tenantId, conversationId, "conversation:updated", {
                        conversationId,
                        assignedUserId: assignedTo,
                        status: "OPEN",
                        timestamp: new Date().toISOString()
                    });
                }
            }
        } catch (distErr) {
            logger.error({ err: distErr, conversationId: (typeof conversationId !== 'undefined' ? conversationId : 'unknown') }, "[Webhook] Auto-distribution failed");
        }

        return res.status(200).json({ ok: true, conversationId });
    } catch (error) {
        logger.error({ 
            err: error, 
            requestId: (req as any).requestId, 
            payload: req.body,
            url: req.originalUrl
        }, "[Webhook] Request failed");
        next(error);
    }
});

router.post("/external/webchat/message", async (req, res, next) => {
    try {
        const { connectorId } = req.body;
        if (!connectorId) return res.status(400).json({ error: "Missing connectorId" });

        const connector = await loadConnector(connectorId);
        const adapters = req.app.get("adapters");
        const adapter = adapters.webchat;

        const inbound = adapter.parseInbound(req.body, connector);
        if (!inbound) return res.status(400).json({ error: "Invalid payload" });

        const conversationId = await resolveConversationForInbound(inbound, connector.ConnectorId, connector.ChannelId);
        await saveInboundMessage(inbound, conversationId);

        // --- Automatic Distribution ---
        const queues = await listQueues(inbound.tenantId);
        const targetQueue = queues[0]?.QueueId;
        if (targetQueue) {
            await distributeConversation(inbound.tenantId, conversationId, targetQueue);
        }

        const io = req.app.get("io");
        if (io) {
            emitConversationEvent(io, inbound.tenantId, conversationId, "message:new", {
                conversationId,
                senderExternalId: inbound.externalUserId,
                text: inbound.text ?? `[${inbound.mediaType}]`,
                mediaType: inbound.mediaType,
                mediaUrl: inbound.mediaUrl,
                direction: "IN"
            });
        }

        res.json({ ok: true, conversationId });
    } catch (error) {
        logger.error({ 
            err: error, 
            requestId: (req as any).requestId, 
            payload: req.body 
        }, "[Webhook] Webchat request failed");
        next(error);
    }
});

export default router;
