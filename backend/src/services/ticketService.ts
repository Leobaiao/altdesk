import { getPool } from "../db.js";
import { logger } from "../lib/logger.js";

/**
 * Cria um ticket vinculado a uma conversa.
 */
export async function createTicketForConversation(tenantId: string, conversationId: string, priority: string = "MEDIUM", actorUserId?: string) {
    const pool = await getPool();

    // Verify if conversation already has an active ticket
    const existing = await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .query(`
            SELECT TOP 1 * FROM altdesk.Ticket
            WHERE TenantId = @tenantId AND ConversationId = @conversationId AND Status != 'CLOSED' AND DeletedAt IS NULL
            ORDER BY CreatedAt DESC
        `);

    if (existing.recordset.length > 0) {
        return existing.recordset[0];
    }

    // Fetch SLA Policy for the priority
    const policyResult = await pool.request()
        .input("tenantId", tenantId)
        .input("priority", priority)
        .query(`SELECT TOP 1 * FROM altdesk.SLAPolicy WHERE TenantId = @tenantId AND Priority = @priority`);
        
    let firstResponseMinutes = 120; // Default for MEDIUM
    let resolutionMinutes = 720;
    
    if (policyResult.recordset.length > 0) {
        firstResponseMinutes = policyResult.recordset[0].FirstResponseMinutes;
        resolutionMinutes = policyResult.recordset[0].ResolutionMinutes;
    } else {
        // Fallbacks based on spec if policy doesn't exist
        switch (priority) {
            case "LOW": firstResponseMinutes = 240; resolutionMinutes = 1440; break;
            case "HIGH": firstResponseMinutes = 60; resolutionMinutes = 240; break;
            case "CRITICAL": firstResponseMinutes = 15; resolutionMinutes = 60; break;
        }
    }

    const now = new Date();
    const firstResponseDue = new Date(now.getTime() + firstResponseMinutes * 60000);
    const resolutionDue = new Date(now.getTime() + resolutionMinutes * 60000);

    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .input("priority", priority)
        .input("firstResponseDue", firstResponseDue)
        .input("resolutionDue", resolutionDue)
        .query(`
            INSERT INTO altdesk.Ticket (TenantId, ConversationId, Priority, Status, SLAFirstResponseDue, SLAResolutionDue, SlaStatus)
            OUTPUT inserted.*
            VALUES (@tenantId, @conversationId, @priority, 'NEW', @firstResponseDue, @resolutionDue, 'ON_TIME')
        `);

    const newTicket = result.recordset[0];
    
    // Log the event (non-blocking)
    try {
        await pool.request()
            .input("tenantId", tenantId)
            .input("ticketId", newTicket.TicketId)
            .input("eventType", "CREATED")
            .input("actorUserId", actorUserId || null)
            .query(`
                INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId)
                VALUES (@tenantId, @ticketId, @eventType, 'NEW', @actorUserId)
            `);
    } catch (e) {
        logger.error({ err: e, ticketId: newTicket.TicketId }, "Failed to log TicketEvent for creation");
    }

    logger.info({ tenantId, conversationId, ticketId: newTicket.TicketId }, "Ticket created with SLA applied");
    return newTicket;
}

/**
 * Busca o ticket ativo de uma conversa.
 */
export async function getActiveTicketForConversation(tenantId: string, conversationId: string) {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .query(`
            SELECT TOP 1 * FROM altdesk.Ticket
            WHERE TenantId = @tenantId AND ConversationId = @conversationId AND Status != 'CLOSED' AND DeletedAt IS NULL
            ORDER BY CreatedAt DESC
        `);
    return result.recordset[0] || null;
}
