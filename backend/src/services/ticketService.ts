import { getPool } from "../db.js";
import { logger } from "../lib/logger.js";

/**
 * Cria um ticket vinculado a uma conversa.
 */
export async function createTicketForConversation(tenantId: string, conversationId: string, priority: string = "MEDIUM") {
    const pool = await getPool();

    // Verify if conversation already has an active ticket
    const existing = await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .query(`
            SELECT TOP 1 * FROM altdesk.Ticket
            WHERE TenantId = @tenantId AND ConversationId = @conversationId AND Status != 'CLOSED'
            ORDER BY CreatedAt DESC
        `);

    if (existing.recordset.length > 0) {
        return existing.recordset[0];
    }

    // Default SLA Due At (e.g. 24 hours from now)
    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + 24);

    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .input("priority", priority)
        .input("slaDueAt", dueAt)
        .query(`
            INSERT INTO altdesk.Ticket (TenantId, ConversationId, Priority, Status, SLA_DueAt)
            OUTPUT inserted.*
            VALUES (@tenantId, @conversationId, @priority, 'OPEN', @slaDueAt)
        `);

    const newTicket = result.recordset[0];
    logger.info({ tenantId, conversationId, ticketId: newTicket.TicketId }, "Ticket created");
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
            WHERE TenantId = @tenantId AND ConversationId = @conversationId AND Status != 'CLOSED'
            ORDER BY CreatedAt DESC
        `);
    return result.recordset[0] || null;
}
