import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { authMw, requireRole, requirePermission } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { resolveConversationForInbound, saveInboundMessage, saveOutboundMessage, findOrCreateConversation, deleteConversation, deleteMessage } from "../services/conversation.js";
import { assignConversation } from "../services/queue.js";
import { writeAuditLog, extractRequestInfo } from "../services/auditLog.js";
import { recordConversationHistory, getConversationHistory } from "../services/conversationHistory.js";
import { sendCsatIfEnabled } from "../services/csatService.js";
import { AuthenticatedRequest } from "../types/index.js";
import { Response, NextFunction } from "express";

import {
    checkConversationAccess,
    listConversations,
    getConversationMessages,
    getReplyMetadata,
    updateConversationStatus,
    reassignConnectorToDefault,
    changeConversationConnector
} from "../services/chatService.js";
import { listUserAvailableInstances } from "../services/instanceService.js";
import { emitConversationEvent } from "../services/socketService.js";

const router = Router();
router.use(authMw);

router.get("/", requirePermission('chat', 'tickets'), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const conversations = await listConversations(user, limit, offset);
        res.json(conversations);
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/", validateBody(z.object({
    phone: z.string().optional(),
    userId: z.string().optional(),
    name: z.string().optional()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const { phone, userId, name } = req.body;
        
        let conversationId: string;
        
        if (userId) {
            // Conversa interna entre usuários
            const { findOrCreateInternalConversation } = await import("../services/conversation.js");
            conversationId = await findOrCreateInternalConversation(user.tenantId || "", user.userId, userId);
        } else if (phone) {
            // Conversa externa (WhatsApp/Webchat)
            conversationId = await findOrCreateConversation(user.tenantId || "", phone, name, user.userId);
        } else {
            return res.status(400).json({ error: "Informe o telefone ou o ID do usuário." });
        }
        
        const { allowed } = await checkConversationAccess(user, conversationId);
        if (!allowed) {
            return res.status(403).json({ error: "Este contato já possui uma conversa atribuída a outro atendente." });
        }

        res.json({ ok: true, conversationId });
    } catch (error) {
        next(error);
    }
}) as any);

router.delete("/:id", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        await deleteConversation(tenantId || "", conversationId);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

router.delete("/:id/messages/:messageId", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const { id: conversationId, messageId } = req.params;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        await deleteMessage(tenantId || "", messageId);

        const io = req.app.get("io");
        if (io) {
            emitConversationEvent(io, tenantId!, conversationId, "message:deleted", {
                conversationId,
                messageId
            });
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

router.patch("/:id/title", validateBody(z.object({ title: z.string().min(1) })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;
        const { title } = req.body;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        const pool = await getPool();
        await pool.request()
            .input("tenantId", tenantId)
            .input("conversationId", conversationId)
            .input("title", title)
            .query(`UPDATE altdesk.Conversation SET Title = @title WHERE ConversationId = @conversationId AND TenantId = @tenantId`);

        // Emit socket event
        const io = req.app.get("io");
        if (io) {
            emitConversationEvent(io, tenantId!, conversationId, "conversation:updated", {
                conversationId,
                Title: title,
                timestamp: new Date().toISOString()
            });
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);


router.get("/:id", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;

        const { allowed } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        const { getConversationDetails } = await import("../services/chatService.js");
        const details = await getConversationDetails(user, conversationId);
        if (!details) return res.status(404).json({ error: "Conversation not found" });

        res.json(details);
    } catch (error) {
        next(error);
    }
}) as any);

router.get("/:id/messages", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) {
            return res.status(403).json({ error: "Você não tem permissão para acessar esta conversa." });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const messages = await getConversationMessages(conversationId, tenantId, limit, offset);
        res.json(messages);
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/:id/reply", validateBody(z.object({ 
    text: z.string().optional(),
    mediaUrl: z.string().optional(),
    mediaType: z.string().optional(),
    originalName: z.string().optional()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const conversationId = req.params.id;
        const { text, mediaUrl, mediaType, originalName } = req.body;
        const user = req.user;

        if (!text && !mediaUrl) {
            return res.status(400).json({ error: "Mensagem ou anexo é obrigatório" });
        }

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) {
            return res.status(403).json({ error: "Você não tem permissão para responder nesta conversa." });
        }
        
        const metadata = await getReplyMetadata(conversationId, tenantId);
        let externalMessageId: string | undefined;

        if (metadata) {
            const adapters = req.app.get("adapters");
            const adapter = adapters[metadata.provider];

            if (!adapter) {
                return res.status(400).json({ error: `Provider "${metadata.connector.Provider}" não suportado` });
            }

            try {
                if (mediaUrl && typeof adapter.sendMedia === "function") {
                    externalMessageId = await adapter.sendMedia(
                        metadata.connector,
                        metadata.externalUserId,
                        mediaUrl,
                        (mediaType as any) || "document",
                        text,
                        {
                            inReplyTo: metadata.lastExternalMessageId,
                            subject: metadata.subject
                        }
                    );
                } else {
                    let textToSend = text || "";
                    if (mediaUrl) {
                        textToSend = textToSend ? `${textToSend}\n\n[Anexo: ${originalName || 'Arquivo'}](${process.env.PUBLIC_URL || ''}${mediaUrl})` : `[Anexo: ${originalName || 'Arquivo'}](${process.env.PUBLIC_URL || ''}${mediaUrl})`;
                    }

                    externalMessageId = await adapter.sendText(metadata.connector, metadata.externalUserId, textToSend, {
                        inReplyTo: metadata.lastExternalMessageId,
                        subject: metadata.subject
                    });
                }
            } catch (adapterErr: any) {
                const { logger } = await import("../lib/logger.js");
                logger.error({ 
                    err: adapterErr, 
                    conversationId, 
                    provider: metadata.provider,
                    externalUserId: metadata.externalUserId,
                    connectorId: metadata.connector.ConnectorId,
                    errMessage: adapterErr?.message
                }, "[Reply] Adapter send failed");

                // Mensagens de erro específicas para o usuário
                const errMsg = adapterErr?.message || adapterErr?.cause?.message || "";
                const errCode = adapterErr?.cause?.code || "";
                let userMessage: string;

                if (errCode === "ENOTFOUND" || errMsg.includes("ENOTFOUND")) {
                  const hostname = adapterErr?.cause?.hostname || "desconhecido";
                  userMessage = `Servidor do provedor não encontrado (${hostname}). Verifique a URL de conexão nas configurações da instância.`;
                } else if (errCode === "ECONNREFUSED" || errMsg.includes("ECONNREFUSED")) {
                  userMessage = `Conexão recusada pelo provedor. O serviço pode estar fora do ar ou a porta está incorreta.`;
                } else if (errCode === "ETIMEDOUT" || errCode === "ESOCKETTIMEDOUT" || errMsg.includes("timeout")) {
                  userMessage = `Tempo de conexão esgotado. O provedor pode estar lento ou indisponível no momento.`;
                } else if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("Unauthorized")) {
                  userMessage = `Autenticação falhou com o provedor. Verifique o token/apikey nas configurações da instância.`;
                } else if (errMsg.includes("404")) {
                  userMessage = `Endpoint não encontrado no provedor. A URL ou a instância configurada pode estar incorreta.`;
                } else if (errMsg.includes("429")) {
                  userMessage = `Limite de envios atingido no provedor. Aguarde alguns segundos e tente novamente.`;
                } else if (errMsg.includes("session is not reconnectable") || errMsg.includes("disconnected")) {
                  userMessage = `A sessão do WhatsApp está desconectada. Por favor, reconecte escaneando o QR Code novamente.`;
                } else if (errMsg.includes("500") || errMsg.includes("502") || errMsg.includes("503")) {
                  userMessage = `O provedor (${metadata.provider.toUpperCase()}) retornou erro interno. Detalhes: ${errMsg.substring(0, 200)}`;
                } else {
                  userMessage = `Falha ao enviar: ${errMsg.substring(0, 150)}`;
                }

                // Usamos 400 em vez de 500 para erros de provider para não causar crash/unhandled errors no frontend
                return res.status(400).json({ 
                    error: userMessage,
                    provider: metadata.provider
                });
            }
        }

        let messageId: string;
        let direction = user.role === 'END_USER' ? 'IN' : 'OUT';

        if (user.role === 'END_USER') {
            messageId = await saveInboundMessage({
                tenantId: user.tenantId || "",
                externalUserId: user.userId,
                externalChatId: conversationId,
                provider: "INTERNAL",
                channel: "PORTAL",
                timestamp: Date.now(),
                text: text,
                mediaUrl: mediaUrl,
                mediaType: mediaType,
                raw: {}
            }, conversationId, user.userId);
        } else {
            messageId = await saveOutboundMessage(user.tenantId || "", conversationId, text || "", externalMessageId, user.userId, mediaUrl, mediaType);
        }

        // Audit log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'SEND_MESSAGE',
            targetTable: 'Message',
            targetId: messageId,
            messageId,
            afterValues: { conversationId, text, externalMessageId, direction }
        });

        const io = req.app.get("io");
        if (io) {
            emitConversationEvent(io, tenantId!, conversationId, "message:new", {
                conversationId,
                MessageId: messageId,
                ExternalMessageId: externalMessageId,
                senderExternalId: user.role === 'END_USER' ? user.userId : "agent",
                SenderUserId: user.userId,
                SenderName: user.displayName,
                text: text || "",
                mediaUrl: mediaUrl,
                mediaType: mediaType,
                direction
            });
            emitConversationEvent(io, tenantId!, conversationId, "conversation:updated", {
                conversationId,
                lastMessage: text || (mediaUrl ? "[Anexo]" : ""),
                direction,
                timestamp: new Date().toISOString()
            });
        }

        res.json({ ok: true, conversationId });
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/:id/status", validateBody(z.object({ 
    status: z.enum(["OPEN", "RESOLVED", "PENDING"]),
    resolution: z.string().optional()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const { status, resolution } = req.body;
        const conversationId = req.params.id;

        if (status === 'RESOLVED' && (!resolution || !resolution.trim())) {
            return res.status(400).json({ error: "O texto de resolução é obrigatório para fechar o chamado." });
        }

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        await updateConversationStatus(conversationId, tenantId, status, resolution);

        // Registrar no histórico de interações
        const action = status === 'RESOLVED' ? 'CLOSED' : 'STATUS_CHANGED';
        await recordConversationHistory({
            tenantId: tenantId!,
            conversationId,
            action,
            actorUserId: user.userId,
            metadata: { newStatus: status, resolution }
        });

        // Audit log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'UPDATE_CONVERSATION_STATUS',
            targetTable: 'Conversation',
            targetId: conversationId,
            afterValues: { status }
        });

        const io = req.app.get("io");

        if (status === 'RESOLVED' && resolution) {
            const agentName = user.displayName || user.email || "Sistema";
            const noteText = `✅ Chamado resolvido por ${agentName}.\nResolução: ${resolution}`;
            
            const pool = await getPool();
            const rMsg = await pool.request()
                .input("tenantId", tenantId)
                .input("conversationId", conversationId)
                .input("senderUserId", user.userId)
                .input("body", noteText)
                .query(`
                    INSERT INTO altdesk.Message (TenantId, ConversationId, SenderExternalId, Direction, Body)
                    OUTPUT INSERTED.MessageId, INSERTED.CreatedAt
                    VALUES (@tenantId, @conversationId, @senderUserId, 'INTERNAL', @body)
                `);

            if (io) {
                const newMsgId = rMsg.recordset[0]?.MessageId;
                const createdAt = rMsg.recordset[0]?.CreatedAt;
                emitConversationEvent(io, tenantId!, conversationId, "message:new", {
                    conversationId,
                    MessageId: newMsgId,
                    senderExternalId: user.userId,
                    senderName: agentName,
                    text: noteText,
                    direction: "INTERNAL",
                    CreatedAt: createdAt || new Date().toISOString()
                });
            }
        }

        if (io) {
            emitConversationEvent(io, tenantId!, conversationId, "conversation:updated", {
                conversationId,
                timestamp: new Date().toISOString()
            });
        }

        // --- CSAT Trigger ---
        if (status === 'RESOLVED') {
            await sendCsatIfEnabled(tenantId!, conversationId, io);
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// Internal note (visible only to agents)
router.post("/:id/note", validateBody(z.object({ text: z.string().min(1) })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;
        const { text } = req.body;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });
        if (user.role === 'END_USER') return res.status(403).json({ error: "Colaboradores não podem adicionar notas internas." });

        const pool = await getPool();
        const rMsg = await pool.request()
            .input("tenantId", tenantId)
            .input("conversationId", conversationId)
            .input("senderUserId", user.userId)
            .input("body", text)
            .query(`
                INSERT INTO altdesk.Message (TenantId, ConversationId, SenderExternalId, Direction, Body)
                OUTPUT INSERTED.MessageId, INSERTED.CreatedAt
                VALUES (@tenantId, @conversationId, @senderUserId, 'INTERNAL', @body)
            `);

        // Registrar no histórico de interações para aparecer na Linha do Tempo
        await recordConversationHistory({
            tenantId: tenantId!,
            conversationId,
            action: 'COMMENTED',
            actorUserId: user.userId,
            metadata: { text }
        });

        const io = req.app.get("io");
        if (io) {
            const newMsgId = rMsg.recordset[0]?.MessageId;
            const createdAt = rMsg.recordset[0]?.CreatedAt;
            
            emitConversationEvent(io, tenantId!, conversationId, "message:new", {
                conversationId,
                MessageId: newMsgId,
                senderExternalId: user.userId,
                SenderUserId: user.userId,
                senderName: user.displayName || user.email || "Agente",
                text,
                direction: "INTERNAL",
                CreatedAt: createdAt || new Date().toISOString()
            });

            emitConversationEvent(io, tenantId!, conversationId, "conversation:updated", {
                conversationId,
                lastMessage: text,
                direction: "INTERNAL",
                timestamp: createdAt || new Date().toISOString()
            });
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/:id/assign", validateBody(z.object({
    queueId: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
    reason: z.string().optional()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const { queueId, userId, reason } = req.body;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        await assignConversation(tenantId || "", conversationId, queueId || null, userId || null);

        // Create automatic context note on transfer
        if (userId || queueId) {
            const agentName = user.displayName || user.email || "Agente";
            let noteText = `📋 Transferido por ${agentName}.`;
            if (reason) noteText += `\nMotivo: ${reason}`;

            const pool = await getPool();
            await pool.request()
                .input("tenantId", tenantId)
                .input("conversationId", conversationId)
                .input("senderUserId", user.userId)
                .input("body", noteText)
                .query(`
                    INSERT INTO altdesk.Message (TenantId, ConversationId, SenderExternalId, Direction, Body)
                    VALUES (@tenantId, @conversationId, @senderUserId, 'INTERNAL', @body)
                `);
        }

        // Registrar no histórico de interações
        if (userId) {
            await recordConversationHistory({
                tenantId: tenantId!,
                conversationId,
                action: 'ASSIGNED',
                actorUserId: user.userId,
                escalatedToUserId: userId,
                metadata: { queueId, reason }
            });
        }

        // Audit log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'ASSIGN_CONVERSATION',
            targetTable: 'Conversation',
            targetId: conversationId,
            afterValues: { queueId, userId }
        });

        const io = req.app.get("io");
        if (io) {
            emitConversationEvent(io, tenantId!, conversationId, "conversation:updated", {
                conversationId,
                timestamp: new Date().toISOString()
            });
        }
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/:id/reassign-connector", requireRole("ADMIN"), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        const provider = await reassignConnectorToDefault(conversationId, tenantId);
        res.json({ ok: true, provider });
    } catch (error) {
        next(error);
    }
}) as any);

router.get("/:id/connectors", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        const pool = await getPool();
        const rCurrent = await pool.request()
            .input("conversationId", conversationId)
            .input("tenantId", tenantId)
            .query(`
                SELECT etm.ConnectorId, cc.Provider, ch.Name as ChannelName
                FROM altdesk.ExternalThreadMap etm
                JOIN altdesk.ChannelConnector cc ON cc.ConnectorId = etm.ConnectorId
                JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
                WHERE etm.ConversationId = @conversationId AND etm.TenantId = @tenantId
            `);
        const currentConnector = rCurrent.recordset[0] || null;

        const available = await listUserAvailableInstances(user.userId, tenantId || "");
        
        res.json({
            currentConnector,
            availableConnectors: available
        });
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/:id/change-connector", validateBody(z.object({
    connectorId: z.string()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;
        const { connectorId } = req.body;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        const provider = await changeConversationConnector(conversationId, tenantId, connectorId);

        // Emit conversation:updated socket event
        const io = req.app.get("io");
        if (io) {
            emitConversationEvent(io, tenantId!, conversationId, "conversation:updated", {
                conversationId,
                SourceChannel: provider === "EMAIL" ? "EMAIL" : "WHATSAPP",
                timestamp: new Date().toISOString()
            });
        }

        res.json({ ok: true, provider });
    } catch (error) {
        next(error);
    }
}) as any);

// Demo internal messages
router.post("/demo/:id/messages", validateBody(z.object({ text: z.string().min(1) })), async (req, res, next) => {
    try {
        const conversationId = req.params.id;
        const { text } = req.body;
        const io = req.app.get("io");

        if (io) {
            io.to(conversationId).emit("message:new", {
                conversationId,
                senderExternalId: "demo",
                text,
                direction: "INTERNAL"
            });
        }
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

// Histórico de interações (versionamento)
router.get("/:id/history", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        const history = await getConversationHistory(tenantId || "", conversationId);
        res.json(history);
    } catch (error) {
        next(error);
    }
});

router.get("/:id/ticket", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;
        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });
        
        const { getActiveTicketForConversation } = await import("../services/ticketService.js");
        const ticket = await getActiveTicketForConversation(tenantId!, conversationId);
        res.json(ticket);
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/:id/ticket", validateBody(z.object({ priority: z.string(), title: z.string().optional() })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const conversationId = req.params.id;
        const { priority, title } = req.body;
        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        const pool = await getPool();
        if (title && title.trim()) {
            await pool.request()
                .input("tenantId", tenantId)
                .input("conversationId", conversationId)
                .input("title", title.trim())
                .query(`UPDATE altdesk.Conversation SET Title = @title WHERE ConversationId = @conversationId AND TenantId = @tenantId`);
        }
        
        const { createTicketForConversation } = await import("../services/ticketService.js");
        const ticket = await createTicketForConversation(tenantId!, conversationId, priority, user.userId);

        if (title && title.trim()) {
            const io = req.app.get("io");
            if (io) {
                emitConversationEvent(io, tenantId!, conversationId, "conversation:updated", {
                    conversationId,
                    Title: title.trim(),
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.json(ticket);
    } catch (error) {
        next(error);
    }
}) as any);

export default router;

