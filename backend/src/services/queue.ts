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
      SELECT * FROM omni.Queue
      WHERE TenantId = @tenantId AND IsActive = 1
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
      INSERT INTO omni.Queue (TenantId, Name)
      VALUES (@tenantId, @name)
    `);
}

export async function deleteQueue(tenantId: string, queueId: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("queueId", queueId)
        .query(`
      UPDATE omni.Queue SET IsActive = 0
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
      UPDATE omni.Conversation
      SET QueueId = @queueId, AssignedUserId = @userId
      WHERE TenantId = @tenantId AND ConversationId = @conversationId
    `);
}
