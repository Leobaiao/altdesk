import { Router } from "express";
import { resolveConversationForInbound, saveInboundMessage, updateMessageStatus } from "../services/conversation.js";
import { Orchestrator, TriageBot } from "../agents.js";
import { loadConnector } from "../utils.js";
import { processCpfValidationFlow, getPendingCpfSession, findContactByCpf } from "../services/cpfValidation.js";

const router = Router();
const orch = new Orchestrator([new TriageBot()]);

router.post("/whatsapp/:provider/:connectorId/*", async (req, res, next) => {
    try {
        const provider = String(req.params.provider).toLowerCase();
        const connectorId = req.params.connectorId;

        const connector = await loadConnector(connectorId);
        const adapters = req.app.get("adapters");
        const adapter = adapters[provider];

        if (!adapter) return res.status(404).send("Unknown provider");

        console.log(`[Webhook] Received ${provider} event: EventType=${req.body?.EventType}, keys=${Object.keys(req.body || {}).join(',')}`);

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
                    io.to(`tenant:${statusUpdate.tenantId}`).emit("message:status", {
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

        // --- Fluxo de Validação de CPF ---
        // Verifica se existe sessão pendente de CPF OU se é um contato novo
        const hasPendingSession = getPendingCpfSession(inbound.externalUserId);
        const phone = inbound.externalUserId.replace(/@.*$/, "");

        if (hasPendingSession || !(await findContactByCpf(inbound.tenantId, phone))) {
            // Só ativa o fluxo de CPF se o contato não tem CPF cadastrado
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
                    } catch (sendErr) {
                        console.error("[CPF Flow] Erro ao enviar resposta:", sendErr);
                    }
                }

                if (!cpfResult.completed) {
                    // Ainda no fluxo de CPF, não prosseguir com orquestrador
                    return res.status(200).json({ ok: true, conversationId, cpfFlow: true });
                }
            } catch (cpfErr) {
                console.error("[CPF Flow] Erro no fluxo de validação:", cpfErr);
            }
        }
        // --- Fim do Fluxo de CPF ---

        const io = req.app.get("io");
        if (io) {
            // Emit to specific conversation room (for cross-tenant monitoring/SUPERADMIN)
            io.to(conversationId).emit("message:new", {
                conversationId,
                senderExternalId: inbound.externalUserId,
                text: inbound.text ?? `[${inbound.mediaType}]`,
                mediaType: inbound.mediaType,
                mediaUrl: inbound.mediaUrl,
                direction: "IN"
            });

            // Keep emitting to tenant room for sidebar updates
            io.to(`tenant:${inbound.tenantId}`).emit("message:new", {
                conversationId,
                senderExternalId: inbound.externalUserId,
                text: inbound.text ?? `[${inbound.mediaType}]`,
                mediaType: inbound.mediaType,
                mediaUrl: inbound.mediaUrl,
                direction: "IN"
            });

            io.to(`tenant:${inbound.tenantId}`).emit("conversation:updated", {
                conversationId,
                lastMessage: inbound.text ?? `[${inbound.mediaType}]`,
                direction: "IN",
                timestamp: new Date().toISOString()
            });
        }

        // Run AI orchestration in background
        orch.run("TriageBot", inbound.text ?? "[media]", {
            tenantId: inbound.tenantId,
            conversationId,
            externalSenderId: inbound.externalUserId
        }).then(decisions => {
            // For now, decisions are just logged or can be used to trigger other actions/socket events
        }).catch(err => {
            console.error("Orchestrator background error:", err);
        });

        return res.status(200).json({ ok: true, conversationId });
    } catch (error) {
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

        const io = req.app.get("io");
        if (io) {
            io.to(`tenant:${inbound.tenantId}`).emit("message:new", {
                conversationId,
                senderExternalId: inbound.externalUserId,
                text: inbound.text ?? `[${inbound.mediaType}]`,
                mediaType: inbound.mediaType,
                mediaUrl: inbound.mediaUrl,
                direction: "IN"
            });
            io.to(conversationId).emit("message:new", {
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
        next(error);
    }
});

export default router;
