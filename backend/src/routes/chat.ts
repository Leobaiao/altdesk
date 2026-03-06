import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { authMw } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { resolveConversationForInbound, saveInboundMessage, saveOutboundMessage, findOrCreateConversation, deleteConversation } from "../services/conversation.js";
import { assignConversation } from "../services/queue.js";
import { writeAuditLog, extractRequestInfo } from "../services/auditLog.js";
import { recordConversationHistory, getConversationHistory } from "../services/conversationHistory.js";

const router = Router();
router.use(authMw);

// Helper para validar se o usuário tem acesso à conversa
async function checkConversationAccess(user: any, conversationId: string): Promise<{ allowed: boolean, tenantId: string | null }> {
    const pool = await getPool();
    const r = await pool.request()
        .input("conversationId", conversationId)
        .query("SELECT TenantId, AssignedUserId FROM omni.Conversation WHERE ConversationId = @conversationId");

    if (r.recordset.length === 0) return { allowed: false, tenantId: null };

    const conv = r.recordset[0];
    const ownerId = conv.AssignedUserId;
    const convTenantId = conv.TenantId;

    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        // SUPERADMIN sees everything, ADMIN only if same tenant
        if (user.role === 'SUPERADMIN' || convTenantId === user.tenantId) {
            return { allowed: true, tenantId: convTenantId };
        }
    }

    if (convTenantId !== user.tenantId) return { allowed: false, tenantId: null };

    // AGENT access check
    const allowed = ownerId === null || ownerId === user.userId;
    return { allowed, tenantId: convTenantId };
}

router.get("/", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();

        // Se for AGENTE, vê apenas as dele OU unassigned (em fila)
        let filterClause = "WHERE c.TenantId = @tenantId";
        let messageFilter = "WHERE Direction = 'OUT' AND TenantId = @tenantId";
        if (user.role === 'AGENT') {
            filterClause += " AND (c.AssignedUserId = @userId OR c.AssignedUserId IS NULL)";
        } else if (user.role === 'SUPERADMIN') {
            // SUPERADMIN vê todas as conversas de todos os tenants
            filterClause = "WHERE 1=1";
            messageFilter = "WHERE Direction = 'OUT'";
        }

        const r = await pool.request()
            .input("tenantId", user.tenantId)
            .input("userId", user.userId)
            .query(`
        WITH LastOutbound AS (
          SELECT ConversationId, MAX(CreatedAt) as LastOutAt
          FROM omni.Message
          ${messageFilter}
          GROUP BY ConversationId
        )
        SELECT c.ConversationId, c.Title, c.Status, c.Kind, c.LastMessageAt, c.QueueId, c.AssignedUserId,
               c.SourceChannel, c.InteractionSequence, c.CreatedAt,
               etm.ExternalUserId,
               q.Name AS QueueName,
               assignedUser.DisplayName AS AssignedUserName,
               assignedUser.Email AS AssignedUserEmail,
               ct.Name AS ContactName,
               ct.CPF AS ContactCPF,
               ct.Phone AS ContactPhone,
               (
                 SELECT COUNT(*) 
                 FROM omni.Message m
                 WHERE m.ConversationId = c.ConversationId
                   AND m.Direction = 'IN'
                   AND m.CreatedAt > ISNULL(lo.LastOutAt, '1900-01-01')
               ) AS UnreadCount
        FROM omni.Conversation c
        LEFT JOIN omni.ExternalThreadMap etm ON etm.ConversationId = c.ConversationId
        LEFT JOIN omni.Queue q ON q.QueueId = c.QueueId
        LEFT JOIN omni.[User] assignedUser ON assignedUser.UserId = c.AssignedUserId
        LEFT JOIN omni.Contact ct ON ct.Phone = REPLACE(REPLACE(etm.ExternalUserId, '@s.whatsapp.net', ''), '@c.us', '') AND ct.TenantId = c.TenantId
        LEFT JOIN LastOutbound lo ON lo.ConversationId = c.ConversationId
        ${filterClause}
        ORDER BY c.LastMessageAt DESC
      `);
        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
});

router.post("/", validateBody(z.object({
    phone: z.string().min(10),
    name: z.string().optional()
})), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const { phone, name } = req.body;
        // Passa o userId para auto-atribuição imediata se for um agente iniciando o chat
        const conversationId = await findOrCreateConversation(user.tenantId, phone, name, user.userId);
        res.json({ ok: true, conversationId });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        await deleteConversation(tenantId || "", conversationId);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.get("/:id/messages", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) {
            return res.status(403).json({ error: "Você não tem permissão para acessar esta conversa." });
        }

        const pool = await getPool();
        const r = await pool.request()
            .input("conversationId", conversationId)
            .input("tenantId", tenantId)
            .query(`
        SELECT MessageId, Body, Direction, SenderExternalId, MediaType, MediaUrl, Status, CreatedAt
        FROM omni.Message
        WHERE ConversationId = @conversationId AND TenantId = @tenantId
        ORDER BY CreatedAt ASC
      `);
        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
});

router.post("/:id/reply", validateBody(z.object({ text: z.string().min(1) })), async (req, res, next) => {
    try {
        const conversationId = req.params.id;
        const { text } = req.body;
        const user = (req as any).user;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) {
            return res.status(403).json({ error: "Você não tem permissão para responder nesta conversa." });
        }

        const pool = await getPool();
        const r = await pool.request()
            .input("conversationId", conversationId)
            .input("tenantId", tenantId)
            .query(`
        SELECT
          etm.ExternalUserId,
          etm.ConnectorId,
          cc.Provider,
          cc.ConfigJson
        FROM omni.ExternalThreadMap etm
        JOIN omni.ChannelConnector cc ON cc.ConnectorId = etm.ConnectorId
        WHERE etm.ConversationId = @conversationId
          AND etm.TenantId = @tenantId
      `);

        if (r.recordset.length === 0) {
            return res.status(404).json({ error: "Conversa não encontrada ou sem canal externo" });
        }

        const { ExternalUserId, Provider, ConnectorId, ConfigJson } = r.recordset[0];
        const provider = String(Provider).toLowerCase();

        // We must pass adapter dependencies differently, since they were in index.ts
        // For now we will grab adapters from req.app if needed or import statically.
        // The cleanest is to use the App's injected adapters, or a separate module.
        const adapters = req.app.get("adapters");
        const adapter = adapters[provider];

        if (!adapter) {
            return res.status(400).json({ error: `Provider "${Provider}" não suportado` });
        }

        const connector = { ConnectorId, Provider, ConfigJson };
        await adapter.sendText(connector, ExternalUserId, text);
        await saveOutboundMessage(user.tenantId, conversationId, text);

        const io = req.app.get("io");
        if (io) {
            // Also emit to specific conversation room
            io.to(conversationId).emit("message:new", {
                conversationId,
                senderExternalId: "agent",
                text,
                direction: "OUT"
            });
            // Emit to the conversation's tenant room
            io.to(`tenant:${tenantId}`).emit("message:new", {
                conversationId,
                senderExternalId: "agent",
                text,
                direction: "OUT"
            });
            io.to(`tenant:${tenantId}`).emit("conversation:updated", {
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
});

router.post("/:id/status", validateBody(z.object({ status: z.enum(["OPEN", "RESOLVED", "PENDING"]) })), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const { status } = req.body;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        const pool = await getPool();
        await pool.request()
            .input("tenantId", tenantId)
            .input("conversationId", conversationId)
            .input("status", status)
            .query("UPDATE omni.Conversation SET Status = @status WHERE TenantId = @tenantId AND ConversationId = @conversationId");

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
            io.to(conversationId).emit("conversation:updated", { conversationId, timestamp: new Date().toISOString() });
            io.to(`tenant:${tenantId}`).emit("conversation:updated", {
                conversationId: req.params.id,
                timestamp: new Date().toISOString()
            });
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/assign", validateBody(z.object({
    queueId: z.string().nullable().optional(),
    userId: z.string().nullable().optional()
})), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const { queueId, userId } = req.body;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        await assignConversation(tenantId || "", conversationId, queueId || null, userId || null);

        // Registrar no histórico de interações
        if (userId) {
            await recordConversationHistory({
                tenantId: tenantId!,
                conversationId,
                action: 'ASSIGNED',
                actorUserId: user.userId,
                escalatedToUserId: userId,
                metadata: { queueId }
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
            io.to(conversationId).emit("conversation:updated", { conversationId, timestamp: new Date().toISOString() });
            io.to(`tenant:${tenantId}`).emit("conversation:updated", {
                conversationId: req.params.id,
                timestamp: new Date().toISOString()
            });
        }
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/reassign-connector", async (req, res, next) => {
    try {
        // Admin requirement handled internally or we could map requireRole middleware
        if ((req as any).user.role !== 'ADMIN' && (req as any).user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: "Forbidden" });
        }

        const user = (req as any).user;
        const conversationId = req.params.id;

        const { allowed, tenantId } = await checkConversationAccess(user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        const pool = await getPool();

        const t = await pool.request()
            .input("tenantId", tenantId)
            .query("SELECT DefaultProvider FROM omni.Tenant WHERE TenantId=@tenantId");
        const defaultProvider = t.recordset[0]?.DefaultProvider || "GTI";

        const c = await pool.request()
            .input("tenantId", tenantId)
            .input("provider", defaultProvider)
            .query(`
        SELECT TOP 1 cc.ConnectorId
        FROM omni.ChannelConnector cc
        JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
        WHERE ch.TenantId=@tenantId AND cc.Provider=@provider AND cc.IsActive=1
      `);

        if (c.recordset.length === 0) return res.status(400).json({ error: "Nenhum conector ativo para o provider padrão" });
        const newConnectorId = c.recordset[0].ConnectorId;

        await pool.request()
            .input("conversationId", conversationId)
            .input("tenantId", tenantId)
            .input("newConnectorId", newConnectorId)
            .query(`
        UPDATE omni.ExternalThreadMap
        SET ConnectorId = @newConnectorId
        WHERE ConversationId = @conversationId AND TenantId = @tenantId
      `);

        res.json({ ok: true, provider: defaultProvider });
    } catch (error) {
        next(error);
    }
});

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

        const history = await getConversationHistory(tenantId!, conversationId);
        res.json(history);
    } catch (error) {
        next(error);
    }
});

export default router;
