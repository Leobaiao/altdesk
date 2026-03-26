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

        // --- Connection Status Update ---
        if (req.body?.EventType === "connection" && (req.body?.state || req.body?.status)) {
            try {
                const cfg = JSON.parse(connector.ConfigJson);
                const state = req.body.state || req.body.status;
                if (cfg.connectionStatus !== state) {
                    cfg.connectionStatus = state;
                    const newConfig = JSON.stringify(cfg);
                    const pool = await (await import('../db.js')).getPool();
                    await pool.request()
                        .input('connectorId', connectorId)
                        .input('configJson', newConfig)
                        .query('UPDATE altdesk.ChannelConnector SET ConfigJson = @configJson WHERE ConnectorId = @connectorId');
                    connector.ConfigJson = newConfig;
                    logger.info({ connectorId, state }, "[Webhook] Updated connection status");
                }
            } catch (e) {
                logger.error({ err: e, connectorId }, "[Webhook] Error updating connection status");
            }
        }
        // --- End Connection Status Update ---

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

        // --- Fluxo Integrado de CPF e Ticket (Service Desk) ---
        const { getPendingCpfSession, processCpfValidationFlow } = await import("../services/cpfValidation.js");
        const { getActiveTicketForConversation, createTicketForConversation } = await import("../services/ticketService.js");
        const { getPool } = await import("../db.js");

        let activeTicket = await getActiveTicketForConversation(inbound.tenantId, conversationId);

        if (!activeTicket) {
            // Se não tem ticket, verifica se o usuário já tem Contato vinculado
            const phone = inbound.externalUserId.replace(/@.*$/, "");
            const pool = await getPool();
            const contactCheck = await pool.request()
                .input("tenantId", inbound.tenantId)
                .input("phone", phone)
                .query(`SELECT TOP 1 ContactId, Name FROM altdesk.Contact WHERE TenantId = @tenantId AND (Phone = @phone OR Phone LIKE '%' + @phone + '%')`);
            
            const hasContact = contactCheck.recordset.length > 0;
            const hasPendingSession = getPendingCpfSession(inbound.externalUserId);

            if (hasPendingSession || !hasContact) {
                try {
                    const cpfResult = await processCpfValidationFlow(
                        inbound.tenantId,
                        inbound.externalUserId,
                        phone,
                        inbound.text ?? ""
                    );

                    // Enviar resposta do fluxo de CPF via adapter
                    if (cpfResult.response) {
                        const fetchConnector = { ConnectorId: connector.ConnectorId, Provider: connector.Provider, ConfigJson: connector.ConfigJson };
                        try {
                            await adapter.sendText(fetchConnector, inbound.externalUserId, cpfResult.response);
                            await saveOutboundMessage(inbound.tenantId, conversationId, cpfResult.response);
                        } catch (sendErr) {
                            logger.error({ err: sendErr }, "[CPF Flow] Erro ao enviar resposta");
                        }
                    }

                    if (!cpfResult.completed) {
                        // Ainda no fluxo de CPF, iterromper o processamento aqui
                        return res.status(200).json({ ok: true, conversationId, cpfFlow: true });
                    } else {
                        // Cadastro concluído ou identificado, criar Ticket agora
                        activeTicket = await createTicketForConversation(inbound.tenantId, conversationId);
                        const ticketNumber = activeTicket.TicketId.split('-')[0].toUpperCase();
                        const ticketMsg = `ESTE É SEU TICKET ${ticketNumber}...\n\nPor favor, digite seu problema ou dúvida para que possamos ajudá-lo.`;
                        
                        const fetchConnector = { ConnectorId: connector.ConnectorId, Provider: connector.Provider, ConfigJson: connector.ConfigJson };
                        await adapter.sendText(fetchConnector, inbound.externalUserId, ticketMsg);
                        await saveOutboundMessage(inbound.tenantId, conversationId, ticketMsg);
                        
                        // Fim do fluxo para esta mensagem, a próxima MSG do usuário será o problema em si
                        return res.status(200).json({ ok: true, conversationId, ticketCreated: true });
                    }
                } catch (cpfErr) {
                    logger.error({ err: cpfErr }, "[CPF Flow] Erro no fluxo de validação");
                }
            } else {
                // Já é contato mas não tinha ticket (ex: contato recorrente criando nova conversa). Cria o ticket diretamente.
                activeTicket = await createTicketForConversation(inbound.tenantId, conversationId);
                const ticketNumber = activeTicket.TicketId.split('-')[0].toUpperCase();
                const ticketMsg = `Olá, ${contactCheck.recordset[0].Name}! ESTE É SEU TICKET ${ticketNumber}...\n\nPor favor, digite qual o seu problema hoje.`;
                
                const fetchConnector = { ConnectorId: connector.ConnectorId, Provider: connector.Provider, ConfigJson: connector.ConfigJson };
                try {
                    await adapter.sendText(fetchConnector, inbound.externalUserId, ticketMsg);
                    await saveOutboundMessage(inbound.tenantId, conversationId, ticketMsg);
                } catch (sendErr) {
                    logger.error({ err: sendErr }, "[Ticket Flow] Erro ao enviar ticket id");
                }
                return res.status(200).json({ ok: true, conversationId, ticketCreated: true });
            }
        }
        // Se já tem ticket ativo, prossegue para salvar a mensagem normalmente e distribuir.
        // --- Fim do Fluxo de Ticket ---

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

        /* BOT DESATIVADO TEMPORARIAMENTE
        // Run AI orchestration in background
        orch.run("TriageBot", inbound.text ?? "[media]", {
            tenantId: inbound.tenantId,
            conversationId,
            externalSenderId: inbound.externalUserId
        }).then(async decisions => {
            const escalation = decisions.find(d => d.type === "ESCALATE");
            if (escalation) {
                // If AI escalates, try to distribute to a human agent
                const queues = await listQueues(inbound.tenantId);
                const targetQueue = queues[0]?.QueueId; // Pick first queue as default for now
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
            }
        }).catch(err => {
            console.error("Orchestrator background error:", err);
        });
        */

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
