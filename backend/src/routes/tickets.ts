import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { authMw, requireRole, requirePermission } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { AuthenticatedRequest } from "../types/index.js";
import { Response, NextFunction } from "express";
import { assignConversation } from "../services/queue.js";

const router = Router();
router.use(authMw);

// Kanban List
router.get("/kanban", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        const pool = await getPool();
        const result = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                SELECT 
                    ISNULL(t.TicketId, c.ConversationId) as TicketId,
                    c.ConversationId,
                    c.TenantId,
                    c.Title,
                    c.LastMessageAt,
                    ISNULL(t.Status, 'NEW') as Status,
                    ISNULL(t.Priority, 'MEDIUM') as Priority,
                    ISNULL(t.SlaStatus, 'ON_TIME') as SlaStatus,
                    ISNULL(t.EscalationLevel, 0) as EscalationLevel,
                    ISNULL(t.KanbanOrder, 0) as KanbanOrder,
                    agentUser.DisplayName as AgentName,
                    reqContact.Name as RequesterName
                FROM altdesk.Conversation c
                LEFT JOIN altdesk.Ticket t ON t.ConversationId = c.ConversationId AND t.DeletedAt IS NULL
                LEFT JOIN altdesk.Agent ag ON ag.AgentId = t.AssignedAgentId
                LEFT JOIN altdesk.[User] agentUser ON agentUser.UserId = ag.UserId
                OUTER APPLY (
                    SELECT TOP 1 etm.ExternalUserId
                    FROM altdesk.ExternalThreadMap etm
                    WHERE etm.ConversationId = c.ConversationId
                ) extMap
                OUTER APPLY (
                    SELECT TOP 1 req.Name
                    FROM altdesk.Contact req
                    WHERE req.TenantId = c.TenantId AND (
                        req.Phone = extMap.ExternalUserId OR 
                        (TRY_CAST(extMap.ExternalUserId AS UNIQUEIDENTIFIER) IS NOT NULL AND req.ContactId = CAST(extMap.ExternalUserId AS UNIQUEIDENTIFIER))
                    )
                ) reqContact
                WHERE c.TenantId = @tenantId AND c.DeletedAt IS NULL AND ISNULL(t.Status, 'NEW') != 'CLOSED'
                ORDER BY ISNULL(t.KanbanOrder, 0) ASC, c.LastMessageAt DESC
            `);
            
        const tickets = result.recordset.map(r => ({
            id: r.TicketId,
            conversationId: r.ConversationId,
            title: r.Title,
            status: r.Status,
            priority: r.Priority,
            slaStatus: r.SlaStatus,
            escalationLevel: r.EscalationLevel,
            kanbanOrder: r.KanbanOrder,
            assignedAgent: r.AgentName ? { name: r.AgentName } : null,
            requester: r.RequesterName ? { name: r.RequesterName } : null
        }));

        res.json(tickets);
    } catch (error) {
        next(error);
    }
}) as any);

// Update Status
router.patch("/:id/status", validateBody(z.object({ status: z.string(), kanbanOrder: z.number().optional() })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        const ticketId = req.params.id; // Could be TicketId or ConversationId
        const { status, kanbanOrder } = req.body;
        
        const pool = await getPool();
        
        // Check if ticket exists by TicketId OR ConversationId
        const existingResult = await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .query(`SELECT * FROM altdesk.Ticket WHERE TenantId = @tenantId AND (TicketId = @ticketId OR ConversationId = @ticketId)`);
            
        let oldTicket = existingResult.recordset.length > 0 ? existingResult.recordset[0] : null;
        
        let slaPaused = oldTicket?.SlaPaused ?? false;
        let slaPausedAt = oldTicket?.SlaPausedAt ?? null;
        let slaPauseDurationMinutes = oldTicket?.SlaPauseDurationMinutes ?? 0;
        let slaFirstResponseDue = oldTicket?.SLAFirstResponseDue ?? null;
        let slaResolutionDue = oldTicket?.SLAResolutionDue ?? null;
        
        if (['WAITING_CUSTOMER', 'WAITING_THIRD_PARTY'].includes(status) && !slaPaused) {
            slaPaused = true;
            slaPausedAt = new Date();
        }
        
        if (oldTicket?.SlaPaused && ['NEW', 'TRIAGE', 'IN_PROGRESS', 'ESCALATED'].includes(status)) {
            const pausedMinutes = Math.floor((Date.now() - new Date(oldTicket.SlaPausedAt).getTime()) / 60000);
            slaPaused = false;
            slaPausedAt = null;
            slaPauseDurationMinutes += pausedMinutes;
            
            if (slaFirstResponseDue) {
                slaFirstResponseDue = new Date(new Date(slaFirstResponseDue).getTime() + pausedMinutes * 60000);
            }
            if (slaResolutionDue) {
                slaResolutionDue = new Date(new Date(slaResolutionDue).getTime() + pausedMinutes * 60000);
            }
        }
        
        let resolvedAt = oldTicket?.ResolvedAt ?? null;
        if (status === 'RESOLVED' && oldTicket?.Status !== 'RESOLVED') {
            resolvedAt = new Date();
        }

        // Use MERGE to update or insert the ticket
        await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .input("status", status)
            .input("kanbanOrder", kanbanOrder ?? (oldTicket?.KanbanOrder ?? 0))
            .input("slaPaused", slaPaused)
            .input("slaPausedAt", slaPausedAt)
            .input("slaPauseDurationMinutes", slaPauseDurationMinutes)
            .input("slaFirstResponseDue", slaFirstResponseDue)
            .input("slaResolutionDue", slaResolutionDue)
            .input("resolvedAt", resolvedAt)
            .query(`
                MERGE altdesk.Ticket AS target
                USING (SELECT @ticketId AS Id) AS source
                ON target.TenantId = @tenantId AND (target.TicketId = source.Id OR target.ConversationId = source.Id)
                WHEN MATCHED THEN
                    UPDATE SET 
                        Status = @status,
                        KanbanOrder = @kanbanOrder,
                        SlaPaused = @slaPaused,
                        SlaPausedAt = @slaPausedAt,
                        SlaPauseDurationMinutes = @slaPauseDurationMinutes,
                        SLAFirstResponseDue = @slaFirstResponseDue,
                        SLAResolutionDue = @slaResolutionDue,
                        ResolvedAt = @resolvedAt,
                        UpdatedAt = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (TicketId, TenantId, ConversationId, Priority, Status, EscalationLevel, SlaStatus, SlaPaused, SlaPauseDurationMinutes, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (NEWID(), @tenantId, @ticketId, 'MEDIUM', @status, 0, 'ON_TIME', @slaPaused, @slaPauseDurationMinutes, @kanbanOrder, SYSUTCDATETIME(), SYSUTCDATETIME());
            `);
            
        if (oldTicket) {
            await pool.request()
                .input("tenantId", tenantId)
                .input("ticketId", oldTicket.TicketId)
                .input("actorUserId", req.user.userId)
                .input("eventType", "STATUS_CHANGED")
                .input("oldValue", oldTicket.Status)
                .input("newValue", status)
                .query(`
                    INSERT INTO altdesk.TicketEvent (TenantId, TicketId, ActorUserId, EventType, OldValue, NewValue)
                    VALUES (@tenantId, @ticketId, @actorUserId, @eventType, @oldValue, @newValue)
                `);
        }
            
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// Assign Ticket
router.patch("/:id/assign", validateBody(z.object({ userId: z.string().nullable() })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        const ticketId = req.params.id;
        const { userId } = req.body;
        
        const pool = await getPool();
        
        const existingResult = await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .query(`SELECT ConversationId, AssignedAgentId FROM altdesk.Ticket WHERE TenantId = @tenantId AND TicketId = @ticketId`);
            
        if (existingResult.recordset.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }
        
        const ticket = existingResult.recordset[0];
        
        // Resolve UserId -> AgentId (FK references Agent table)
        let agentId: string | null = null;
        if (userId) {
            const agentResult = await pool.request()
                .input("userId", userId)
                .query(`SELECT AgentId FROM altdesk.Agent WHERE UserId = @userId`);
            agentId = agentResult.recordset.length > 0 ? agentResult.recordset[0].AgentId : null;
            if (!agentId) {
                return res.status(400).json({ error: "User does not have an agent record" });
            }
        }
        
        await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .input("agentId", agentId)
            .query(`UPDATE altdesk.Ticket SET AssignedAgentId = @agentId, UpdatedAt = SYSUTCDATETIME() WHERE TicketId = @ticketId AND TenantId = @tenantId`);
            
        if (userId) {
            await assignConversation(tenantId || "", ticket.ConversationId, null, userId);
        }
        
        await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .input("actorUserId", req.user.userId)
            .input("eventType", "ASSIGNED")
            .input("oldValue", ticket.AssignedAgentId)
            .input("newValue", userId)
            .query(`
                INSERT INTO altdesk.TicketEvent (TenantId, TicketId, ActorUserId, EventType, OldValue, NewValue)
                VALUES (@tenantId, @ticketId, @actorUserId, @eventType, @oldValue, @newValue)
            `);
            
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// Update Priority
router.patch("/:id/priority", validateBody(z.object({ priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]) })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        const ticketId = req.params.id;
        const { priority } = req.body;
        
        const pool = await getPool();
        
        const existingResult = await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .query(`SELECT * FROM altdesk.Ticket WHERE TenantId = @tenantId AND TicketId = @ticketId`);
            
        if (existingResult.recordset.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }
        
        const oldTicket = existingResult.recordset[0];
        const oldPriority = oldTicket.Priority;
        
        // Recalculate SLA deadlines based on new priority policy
        const policyResult = await pool.request()
            .input("tenantId", tenantId)
            .input("priority", priority)
            .query(`SELECT TOP 1 * FROM altdesk.SLAPolicy WHERE TenantId = @tenantId AND Priority = @priority`);
        
        let firstResponseMinutes = 120;
        let resolutionMinutes = 720;
        if (policyResult.recordset.length > 0) {
            firstResponseMinutes = policyResult.recordset[0].FirstResponseMinutes;
            resolutionMinutes = policyResult.recordset[0].ResolutionMinutes;
        } else {
            switch (priority) {
                case "LOW": firstResponseMinutes = 240; resolutionMinutes = 1440; break;
                case "HIGH": firstResponseMinutes = 60; resolutionMinutes = 240; break;
                case "CRITICAL": firstResponseMinutes = 15; resolutionMinutes = 60; break;
            }
        }
        
        // Recalculate from ticket creation time, accounting for pause duration
        const createdAt = new Date(oldTicket.CreatedAt).getTime();
        const pauseOffset = (oldTicket.SlaPauseDurationMinutes || 0) * 60000;
        const newFirstResponseDue = oldTicket.FirstResponseAt ? oldTicket.SLAFirstResponseDue : new Date(createdAt + firstResponseMinutes * 60000 + pauseOffset);
        const newResolutionDue = oldTicket.ResolvedAt ? oldTicket.SLAResolutionDue : new Date(createdAt + resolutionMinutes * 60000 + pauseOffset);
        
        await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .input("priority", priority)
            .input("firstResponseDue", newFirstResponseDue)
            .input("resolutionDue", newResolutionDue)
            .query(`UPDATE altdesk.Ticket SET Priority = @priority, SLAFirstResponseDue = @firstResponseDue, SLAResolutionDue = @resolutionDue, UpdatedAt = SYSUTCDATETIME() WHERE TicketId = @ticketId AND TenantId = @tenantId`);
            
        await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .input("actorUserId", req.user.userId)
            .input("eventType", "PRIORITY_CHANGED")
            .input("oldValue", oldPriority)
            .input("newValue", priority)
            .query(`
                INSERT INTO altdesk.TicketEvent (TenantId, TicketId, ActorUserId, EventType, OldValue, NewValue)
                VALUES (@tenantId, @ticketId, @actorUserId, @eventType, @oldValue, @newValue)
            `);
            
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// Manual Escalate
router.post("/:id/escalate", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        const ticketId = req.params.id;
        
        const pool = await getPool();
        
        const existingResult = await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .query(`SELECT EscalationLevel FROM altdesk.Ticket WHERE TenantId = @tenantId AND TicketId = @ticketId`);
            
        if (existingResult.recordset.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }
        
        const nextLevel = existingResult.recordset[0].EscalationLevel + 1;
        
        await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .input("nextLevel", nextLevel)
            .query(`
                UPDATE altdesk.Ticket SET 
                    EscalationLevel = @nextLevel, 
                    Status = 'ESCALATED', 
                    Priority = 'CRITICAL',
                    EscalatedAt = SYSUTCDATETIME(),
                    EscalationReason = 'MANUAL',
                    UpdatedAt = SYSUTCDATETIME() 
                WHERE TicketId = @ticketId AND TenantId = @tenantId
            `);
            
        await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", ticketId)
            .input("actorUserId", req.user.userId)
            .input("eventType", "MANUAL_ESCALATED")
            .input("oldValue", String(nextLevel - 1))
            .input("newValue", String(nextLevel))
            .query(`
                INSERT INTO altdesk.TicketEvent (TenantId, TicketId, ActorUserId, EventType, OldValue, NewValue)
                VALUES (@tenantId, @ticketId, @actorUserId, @eventType, @oldValue, @newValue)
            `);
            
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// SLA Policies
router.get("/sla/policies", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        const pool = await getPool();
        const result = await pool.request()
            .input("tenantId", tenantId)
            .query(`SELECT * FROM altdesk.SLAPolicy WHERE TenantId = @tenantId`);
        res.json(result.recordset);
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/sla/policies", validateBody(z.object({
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    firstResponseMinutes: z.number(),
    resolutionMinutes: z.number(),
    warningBeforeMinutes: z.number().optional()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        const { priority, firstResponseMinutes, resolutionMinutes, warningBeforeMinutes } = req.body;
        const pool = await getPool();
        
        await pool.request()
            .input("tenantId", tenantId)
            .input("priority", priority)
            .input("first", firstResponseMinutes)
            .input("res", resolutionMinutes)
            .input("warning", warningBeforeMinutes || 10)
            .query(`
                MERGE altdesk.SLAPolicy AS target
                USING (SELECT @tenantId AS TenantId, @priority AS Priority) AS source
                ON target.TenantId = source.TenantId AND target.Priority = source.Priority
                WHEN MATCHED THEN
                    UPDATE SET FirstResponseMinutes = @first, ResolutionMinutes = @res, WarningBeforeMinutes = @warning, UpdatedAt = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (TenantId, Priority, FirstResponseMinutes, ResolutionMinutes, WarningBeforeMinutes)
                    VALUES (@tenantId, @priority, @first, @res, @warning);
            `);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// Escalation Policies
router.get("/escalation/policies", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        const pool = await getPool();
        const result = await pool.request()
            .input("tenantId", tenantId)
            .query(`SELECT * FROM altdesk.EscalationPolicy WHERE TenantId = @tenantId`);
        res.json(result.recordset);
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/escalation/policies", validateBody(z.object({
    level: z.number(),
    assignToRole: z.string(),
    notifyEmail: z.boolean().optional(),
    notifyInApp: z.boolean().optional()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        const { level, assignToRole, notifyEmail, notifyInApp } = req.body;
        const pool = await getPool();
        
        await pool.request()
            .input("tenantId", tenantId)
            .input("level", level)
            .input("role", assignToRole)
            .input("email", notifyEmail !== false)
            .input("inapp", notifyInApp !== false)
            .query(`
                INSERT INTO altdesk.EscalationPolicy (TenantId, Level, AssignToRole, NotifyEmail, NotifyInApp)
                VALUES (@tenantId, @level, @role, @email, @inapp)
            `);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
