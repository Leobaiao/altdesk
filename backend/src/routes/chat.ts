import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { authMw } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { resolveConversationForInbound, saveInboundMessage, saveOutboundMessage, findOrCreateConversation, deleteConversation } from "../services/conversation.js";
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
    reassignConnectorToDefault
} from "../services/chatService.js";
import { emitConversationEvent } from "../services/socketService.js";

const router = Router();
router.use(authMw);

router.get("/", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
    phone: z.string().min(10),
    name: z.string().optional()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const { phone, name } = req.body;
        const conversationId = await findOrCreateConversation(user.tenantId || "", phone, name, user.userId);
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

router.post("/:id/reply", validateBody(z.object({ text: z.string().min(1) })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const conversationId = req.params.id;
        const { text } = req.body;
        const user = req.user;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) {
            return res.status(403).json({ error: "Você não tem permissão para responder nesta conversa." });
        }

        const metadata = await getReplyMetadata(conversationId, tenantId);
        if (!metadata) {
            return res.status(404).json({ error: "Conversa não encontrada ou sem canal externo" });
        }

        const adapters = req.app.get("adapters");
        const adapter = adapters[metadata.provider];

        if (!adapter) {
            return res.status(400).json({ error: `Provider "${metadata.connector.Provider}" não suportado` });
        }

        await adapter.sendText(metadata.connector, metadata.externalUserId, text);
        await saveOutboundMessage(user.tenantId || "", conversationId, text);

        const io = req.app.get("io");
        if (io) {
            emitConversationEvent(io, tenantId!, conversationId, "message:new", {
                conversationId,
                senderExternalId: "agent",
                text,
                direction: "OUT"
            });
            emitConversationEvent(io, tenantId!, conversationId, "conversation:updated", {
                conversationId,
                lastMessage: text,
                direction: "OUT",
                timestamp: new Date().toISOString()
            });
        }

        res.json({ ok: true, conversationId });
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/:id/status", validateBody(z.object({ status: z.enum(["OPEN", "RESOLVED", "PENDING"]) })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const { status } = req.body;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        await updateConversationStatus(conversationId, tenantId, status);

        // Registrar no histórico de interações
        const action = status === 'RESOLVED' ? 'CLOSED' : 'STATUS_CHANGED';
        await recordConversationHistory({
            tenantId: tenantId!,
            conversationId,
            action,
            actorUserId: user.userId,
            metadata: { newStatus: status }
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

        const pool = await getPool();
        await pool.request()
            .input("tenantId", tenantId)
            .input("conversationId", conversationId)
            .input("senderUserId", user.userId)
            .input("body", text)
            .query(`
                INSERT INTO altdesk.Message (TenantId, ConversationId, SenderExternalId, Direction, Body)
                VALUES (@tenantId, @conversationId, @senderUserId, 'INTERNAL', @body)
            `);

        const io = req.app.get("io");
        if (io) {
            emitConversationEvent(io, tenantId!, conversationId, "message:new", {
                conversationId,
                senderExternalId: user.userId,
                senderName: user.displayName || user.email || "Agente",
                text,
                direction: "INTERNAL"
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

router.post("/:id/reassign-connector", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Admin requirement handled internally or we could map requireRole middleware
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: "Forbidden" });
        }

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

export default router;
