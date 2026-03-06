import { getPool } from "../db.js";

export interface ConversationHistoryEntry {
    tenantId: string;
    conversationId: string;
    action: string; // OPENED, REPLIED, ESCALATED, CLOSED, COMMENTED, ASSIGNED, STATUS_CHANGED
    actorUserId?: string;
    escalatedToUserId?: string;
    metadata?: Record<string, any>;
}

/**
 * Incrementa o InteractionSequence da conversa e registra uma entrada no histórico.
 * Retorna o novo SequenceNumber.
 */
export async function recordConversationHistory(entry: ConversationHistoryEntry): Promise<number> {
    const pool = await getPool();

    // Incrementa InteractionSequence atomicamente e retorna o novo valor
    const seqResult = await pool.request()
        .input("conversationId", entry.conversationId)
        .input("tenantId", entry.tenantId)
        .query(`
      UPDATE omni.Conversation
      SET InteractionSequence = InteractionSequence + 1
      OUTPUT inserted.InteractionSequence
      WHERE ConversationId = @conversationId AND TenantId = @tenantId
    `);

    const sequenceNumber = seqResult.recordset[0]?.InteractionSequence ?? 1;

    // Insere o registro no histórico
    await pool.request()
        .input("tenantId", entry.tenantId)
        .input("conversationId", entry.conversationId)
        .input("sequenceNumber", sequenceNumber)
        .input("action", entry.action)
        .input("actorUserId", entry.actorUserId ?? null)
        .input("escalatedToUserId", entry.escalatedToUserId ?? null)
        .input("metadata", entry.metadata ? JSON.stringify(entry.metadata) : null)
        .query(`
      INSERT INTO omni.ConversationHistory
        (TenantId, ConversationId, SequenceNumber, Action, ActorUserId, EscalatedToUserId, MetadataJson)
      VALUES
        (@tenantId, @conversationId, @sequenceNumber, @action, @actorUserId, @escalatedToUserId, @metadata)
    `);

    return sequenceNumber;
}

/**
 * Lista o histórico de uma conversa em ordem cronológica.
 */
export async function getConversationHistory(tenantId: string, conversationId: string) {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .query(`
      SELECT ch.HistoryId, ch.SequenceNumber, ch.Action, ch.ActorUserId, ch.EscalatedToUserId,
             ch.MetadataJson, ch.CreatedAt,
             u1.Email AS ActorEmail,
             u2.Email AS EscalatedToEmail
      FROM omni.ConversationHistory ch
      LEFT JOIN omni.[User] u1 ON u1.UserId = ch.ActorUserId
      LEFT JOIN omni.[User] u2 ON u2.UserId = ch.EscalatedToUserId
      WHERE ch.ConversationId = @conversationId AND ch.TenantId = @tenantId
      ORDER BY ch.SequenceNumber ASC
    `);
    return r.recordset;
}
