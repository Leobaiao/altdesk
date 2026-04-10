import { getPool } from "../db.js";

export type CannedResponse = {
    CannedResponseId: string;
    TenantId: string;
    Shortcut: string;
    Content: string;
    Title: string;
    CreatedAt: string;
};

export async function listCannedResponses(tenantId: string): Promise<CannedResponse[]> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .query(`
      SELECT * FROM altdesk.CannedResponse
      WHERE TenantId = @tenantId AND DeletedAt IS NULL
      ORDER BY Shortcut ASC
    `);
    return result.recordset as CannedResponse[];
}

export async function createCannedResponse(tenantId: string, shortcut: string, content: string, title: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("shortcut", shortcut)
        .input("content", content)
        .input("title", title)
        .query(`
      INSERT INTO altdesk.CannedResponse (TenantId, Shortcut, Content, Title)
      VALUES (@tenantId, @shortcut, @content, @title)
    `);
}

export async function deleteCannedResponse(tenantId: string, id: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("id", id)
        .query(`
      UPDATE altdesk.CannedResponse SET DeletedAt = SYSUTCDATETIME()
      WHERE TenantId = @tenantId AND CannedResponseId = @id
    `);
}
