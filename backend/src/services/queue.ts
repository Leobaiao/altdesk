import { getPool } from "../db.js";

export type Queue = {
  QueueId: string;
  TenantId: string;
  Name: string;
  IsActive: boolean;
  CreatedAt: string;
};

export async function listQueues(tenantId: string): Promise<Queue[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("tenantId", tenantId)
    .query(`
      SELECT * FROM altdesk.Queue
      WHERE TenantId = @tenantId AND DeletedAt IS NULL
      ORDER BY Name ASC
    `);
  return result.recordset as Queue[];
}

export async function createQueue(tenantId: string, name: string) {
  const pool = await getPool();
  await pool.request()
    .input("tenantId", tenantId)
    .input("name", name)
    .query(`
      INSERT INTO altdesk.Queue (TenantId, Name)
      VALUES (@tenantId, @name)
    `);
}

export async function deleteQueue(tenantId: string, queueId: string) {
  const pool = await getPool();
  await pool.request()
    .input("tenantId", tenantId)
    .input("queueId", queueId)
    .query(`
      UPDATE altdesk.Queue SET DeletedAt = SYSUTCDATETIME(), IsActive = 0
      WHERE TenantId = @tenantId AND QueueId = @queueId
    `);
}

export async function assignConversation(tenantId: string, conversationId: string, queueId: string | null, userId: string | null) {
  const pool = await getPool();
  await pool.request()
    .input("tenantId", tenantId)
    .input("conversationId", conversationId)
    .input("queueId", queueId)
    .input("userId", userId)
    .query(`
      UPDATE altdesk.Conversation
      SET QueueId = @queueId, AssignedUserId = @userId
      WHERE TenantId = @tenantId AND ConversationId = @conversationId
    `);
}

/**
 * Automatically distributes a conversation to the agent with the least active (OPEN) conversations.
 * Only distributes if the conversation has no assigned user yet.
 */
export async function distributeConversation(tenantId: string, conversationId: string, queueId: string) {
  const pool = await getPool();

  // Check if conversation already has an assigned user
  const existing = await pool.request()
    .input("tenantId", tenantId)
    .input("conversationId", conversationId)
    .query(`SELECT AssignedUserId FROM altdesk.Conversation WHERE TenantId = @tenantId AND ConversationId = @conversationId`);

  if (existing.recordset[0]?.AssignedUserId) {
    // Already assigned, don't override
    return existing.recordset[0].AssignedUserId;
  }

  // 1. Find the agent with the fewest open conversations in this tenant.
  // We prioritize agents (HUMAN kind) who are active.
  const result = await pool.request()
    .input("tenantId", tenantId)
    .input("queueId", queueId)
    .query(`
            SELECT TOP 1 a.UserId, COUNT(c.ConversationId) as Load
            FROM altdesk.Agent a
            JOIN altdesk.[User] u ON u.UserId = a.UserId
            LEFT JOIN altdesk.Conversation c ON c.AssignedUserId = a.UserId AND c.Status = 'OPEN'
            WHERE a.TenantId = @tenantId 
              AND a.IsActive = 1 
              AND u.IsActive = 1
              AND a.Kind = 'HUMAN'
              -- Here we could filter by AgentQueue if we had it, for now we distributed to any active agent in the tenant
            GROUP BY a.UserId
            ORDER BY Load ASC
        `);

  if (result.recordset.length > 0) {
    const targetUserId = result.recordset[0].UserId;
    await assignConversation(tenantId, conversationId, queueId, targetUserId);
    return targetUserId;
  }

  return null;
}
