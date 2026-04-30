import { getPool } from "../db.js";
import { logger } from "../lib/logger.js";
import { writeAuditLog } from "./auditLog.js";
import { assignConversation } from "./queue.js";

/**
 * Update SLA statuses and escalate breached tickets.
 */
export async function updateSLAStatusAndEscalate() {
    const pool = await getPool();
    try {
        const now = new Date();

        // Find all tickets that are not RESOLVED or CLOSED, and not paused
        const result = await pool.request().query(`
            SELECT * FROM altdesk.Ticket 
            WHERE Status NOT IN ('RESOLVED', 'CLOSED') 
            AND SlaPaused = 0
            AND DeletedAt IS NULL
        `);

        for (const ticket of result.recordset) {
            // Get policy for this ticket
            const policyResult = await pool.request()
                .input("tenantId", ticket.TenantId)
                .input("priority", ticket.Priority)
                .query(`SELECT TOP 1 * FROM altdesk.SLAPolicy WHERE TenantId = @tenantId AND Priority = @priority`);
            
            let warningBefore = 10;
            if (policyResult.recordset.length > 0) {
                warningBefore = policyResult.recordset[0].WarningBeforeMinutes;
            }

            let newSlaStatus = 'ON_TIME';

            const firstResponseDue = ticket.SLAFirstResponseDue ? new Date(ticket.SLAFirstResponseDue) : null;
            const resolutionDue = ticket.SLAResolutionDue ? new Date(ticket.SLAResolutionDue) : null;
            const firstResponseAt = ticket.FirstResponseAt;

            const firstResponseBreached = !firstResponseAt && firstResponseDue && now > firstResponseDue;
            const resolutionBreached = resolutionDue && now > resolutionDue;

            if (firstResponseBreached || resolutionBreached) {
                newSlaStatus = 'BREACHED';
            } else if (resolutionDue && now > new Date(resolutionDue.getTime() - warningBefore * 60000)) {
                newSlaStatus = 'WARNING';
            } else if (!firstResponseAt && firstResponseDue && now > new Date(firstResponseDue.getTime() - warningBefore * 60000)) {
                newSlaStatus = 'WARNING';
            }

            if (newSlaStatus !== ticket.SlaStatus) {
                await pool.request()
                    .input("ticketId", ticket.TicketId)
                    .input("newSlaStatus", newSlaStatus)
                    .query(`UPDATE altdesk.Ticket SET SlaStatus = @newSlaStatus WHERE TicketId = @ticketId`);

                await pool.request()
                    .input("tenantId", ticket.TenantId)
                    .input("ticketId", ticket.TicketId)
                    .input("eventType", "SLA_STATUS_CHANGED")
                    .input("oldValue", ticket.SlaStatus)
                    .input("newValue", newSlaStatus)
                    .query(`
                        INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, OldValue, NewValue)
                        VALUES (@tenantId, @ticketId, @eventType, @oldValue, @newValue)
                    `);

                // Write audit log
                await writeAuditLog({
                    tenantId: ticket.TenantId,
                    action: "SLA_STATUS_CHANGED",
                    targetTable: "Ticket",
                    targetId: ticket.TicketId,
                    afterValues: { slaStatus: newSlaStatus }
                }).catch(() => {});
            }

            if (newSlaStatus === 'BREACHED') {
                await handleEscalation(ticket);
            }
        }
    } catch (err) {
        logger.error({ err }, "[SLA] Error running worker");
    }
}

async function handleEscalation(ticket: any) {
    const pool = await getPool();

    if (ticket.SlaPaused) return;
    if (['RESOLVED', 'CLOSED'].includes(ticket.Status)) return;

    // Check MaxLevel from the escalation policy (dynamic, not hardcoded)
    const maxLevelResult = await pool.request()
        .input("tenantId", ticket.TenantId)
        .query(`SELECT TOP 1 MaxLevel FROM altdesk.EscalationPolicy WHERE TenantId = @tenantId ORDER BY MaxLevel DESC`);
    const maxLevel = maxLevelResult.recordset.length > 0 ? maxLevelResult.recordset[0].MaxLevel : 3;
    if (ticket.EscalationLevel >= maxLevel) return;

    // Cooldown: don't re-escalate within 30 minutes of last escalation
    if (ticket.EscalatedAt) {
        const lastEscalation = new Date(ticket.EscalatedAt).getTime();
        const cooldownMs = 30 * 60000; // 30 minutes between escalation levels
        if (Date.now() - lastEscalation < cooldownMs) return;
    }

    const nextLevel = ticket.EscalationLevel + 1;

    const policyResult = await pool.request()
        .input("tenantId", ticket.TenantId)
        .input("level", nextLevel)
        .query(`SELECT TOP 1 * FROM altdesk.EscalationPolicy WHERE TenantId = @tenantId AND Level = @level`);

    if (policyResult.recordset.length === 0) return;
    const policy = policyResult.recordset[0];

    // Find available agent by role
    const agentResult = await pool.request()
        .input("tenantId", ticket.TenantId)
        .input("role", policy.AssignToRole)
        .query(`
            SELECT TOP 1 u.UserId, a.AgentId
            FROM altdesk.[User] u
            JOIN altdesk.Agent a ON a.UserId = u.UserId
            WHERE u.TenantId = @tenantId AND u.Role = @role AND u.IsActive = 1
            -- Note: in a real app, order by open tickets count
        `);

    const newAgentId = agentResult.recordset.length > 0 ? agentResult.recordset[0].AgentId : ticket.AssignedAgentId;
    const newUserId = agentResult.recordset.length > 0 ? agentResult.recordset[0].UserId : null;

    await pool.request()
        .input("ticketId", ticket.TicketId)
        .input("nextLevel", nextLevel)
        .input("assignedAgentId", newAgentId)
        .query(`
            UPDATE altdesk.Ticket 
            SET EscalationLevel = @nextLevel,
                AssignedAgentId = @assignedAgentId,
                Status = 'ESCALATED',
                EscalatedAt = SYSUTCDATETIME(),
                EscalationReason = 'SLA_BREACHED',
                Priority = 'CRITICAL',
                UpdatedAt = SYSUTCDATETIME()
            WHERE TicketId = @ticketId
        `);

    if (newUserId) {
        await assignConversation(ticket.TenantId, ticket.ConversationId, null, newUserId).catch(err => logger.error({ err }, "Failed to reassign conversation on escalation"));
    }

    await pool.request()
        .input("tenantId", ticket.TenantId)
        .input("ticketId", ticket.TicketId)
        .input("eventType", "AUTO_ESCALATED")
        .input("oldValue", String(ticket.EscalationLevel))
        .input("newValue", String(nextLevel))
        .input("metadataJson", JSON.stringify({ assignedTo: newAgentId, reason: 'SLA_BREACHED' }))
        .query(`
            INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, OldValue, NewValue, MetadataJson)
            VALUES (@tenantId, @ticketId, @eventType, @oldValue, @newValue, @metadataJson)
        `);

    logger.info({ ticketId: ticket.TicketId, nextLevel }, "[SLA] Ticket Escalated");
}

/**
 * Starts the periodic SLA background worker.
 */
export function startSlaWorker(intervalMs: number = 60000) {
    logger.info({ intervalMs }, "[SLA] Ticket Kanban Worker started");
    setInterval(updateSLAStatusAndEscalate, intervalMs);
}
