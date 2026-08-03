import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { authMw, requireRole, requirePermission } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { AuthenticatedRequest } from "../types/index.js";
import { Response, NextFunction } from "express";
import { emitConversationEvent } from "../services/socketService.js";
import { writeAuditLog, extractRequestInfo } from "../services/auditLog.js";

const router = Router();
router.use(authMw);

router.post("/", requirePermission('chat'), validateBody(z.object({
    targetUserId: z.string().uuid()
})), async (req: any, res: Response, next: NextFunction) => {
    try {
        const { tenantId, userId, displayName } = req.user;
        const { targetUserId } = req.body;
        const pool = await getPool();

        // Check if target user exists
        const targetCheck = await pool.request()
            .input("tenantId", tenantId)
            .input("targetId", targetUserId)
            .query("SELECT DisplayName FROM altdesk.[User] WHERE TenantId=@tenantId AND UserId=@targetId AND DeletedAt IS NULL");
        
        if (targetCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Usuário alvo não encontrado" });
        }
        const targetName = targetCheck.recordset[0].DisplayName || "Agente";

        // 1. Ensure an 'INTERNAL' channel exists
        let channelId: string;
        const channelCheck = await pool.request()
            .input("tenantId", tenantId)
            .query("SELECT TOP 1 ChannelId FROM altdesk.Channel WHERE TenantId=@tenantId AND Provider='INTERNAL' AND IsActive=1");

        if (channelCheck.recordset.length > 0) {
            channelId = channelCheck.recordset[0].ChannelId;
        } else {
            // Create a dedicated internal channel if missing
            const newChannel = await pool.request()
                .input("tenantId", tenantId)
                .input("name", "Chat Interno")
                .input("provider", "INTERNAL")
                .query(`
                    INSERT INTO altdesk.Channel (TenantId, Name, Provider, IsActive) 
                    OUTPUT inserted.ChannelId 
                    VALUES (@tenantId, @name, @provider, 1)
                `);
            channelId = newChannel.recordset[0].ChannelId;
            
            const reqInfo = extractRequestInfo(req);
            writeAuditLog({
                ...reqInfo,
                action: 'CREATE',
                targetTable: 'Channel',
                targetId: channelId,
                afterValues: { Name: "Chat Interno", Provider: "INTERNAL" }
            });
        }

        // 2. Create the conversation (P2P)
        const title = `Chat: ${displayName || 'Usuário'} & ${targetName}`;
        const convResult = await pool.request()
            .input("tenantId", tenantId)
            .input("channelId", channelId)
            .input("requesterUserId", userId)
            .input("assignedUserId", targetUserId)
            .input("title", title)
            .query(`
                INSERT INTO altdesk.Conversation (TenantId, ChannelId, RequesterUserId, AssignedUserId, Title, Kind, Status, SourceChannel)
                OUTPUT inserted.ConversationId, inserted.CreatedAt
                VALUES (@tenantId, @channelId, @requesterUserId, @assignedUserId, @title, 'INTERNAL', 'OPEN', 'PLATFORM')
            `);
        
        const conversationId = convResult.recordset[0].ConversationId;
        const createdAt = convResult.recordset[0].CreatedAt;

        // 3. Emit event to BOTH users
        const io = req.app.get("io");
        if (io) {
            const eventPayload = {
                ConversationId: conversationId,
                Title: title,
                Status: 'OPEN',
                Kind: 'INTERNAL',
                RequesterUserId: userId,
                AssignedUserId: targetUserId,
                CreatedAt: createdAt
            };
            emitConversationEvent(io, tenantId!, conversationId, "conversation:new", eventPayload);
        }

        res.json({ conversationId, title });
    } catch (error) {
        next(error);
    }
});

export default router;
