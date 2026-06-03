import { getPool } from "../db.js";

/**
 * Lists all tags for a tenant.
 */
export async function listTags(tenantId: string) {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT 
                t.TagId, 
                t.Name, 
                t.Description, 
                t.Color,
                (SELECT COUNT(*) FROM altdesk.ConversationTag ct WHERE ct.TagId = t.TagId) as UsageCount
            FROM altdesk.Tag t 
            WHERE t.TenantId = @tenantId AND t.DeletedAt IS NULL 
            ORDER BY t.Name
        `);
    return r.recordset;
}

/**
 * Creates a new tag.
 */
export async function createTag(tenantId: string, name: string, description: string, color: string) {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .input("name", name)
        .input("description", description)
        .input("color", color)
        .query(`
            INSERT INTO altdesk.Tag (TenantId, Name, Description, Color)
            VALUES (@tenantId, @name, @description, @color);
        `);
    
    const created = await pool.request()
        .input("tenantId", tenantId)
        .input("name", name)
        .query("SELECT TOP 1 TagId, Name, Description, Color FROM altdesk.Tag WHERE TenantId = @tenantId AND Name = @name ORDER BY CreatedAt DESC");
    return created.recordset[0];
}

/**
 * Updates an existing tag.
 */
export async function updateTag(tenantId: string, tagId: string, name: string, description: string, color: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("tagId", tagId)
        .input("name", name)
        .input("description", description)
        .input("color", color)
        .query(`
            UPDATE altdesk.Tag
            SET Name = @name, Description = @description, Color = @color
            WHERE TenantId = @tenantId AND TagId = @tagId AND DeletedAt IS NULL
        `);
    
    const updated = await pool.request()
        .input("tenantId", tenantId)
        .input("tagId", tagId)
        .query("SELECT TagId, Name, Description, Color FROM altdesk.Tag WHERE TenantId = @tenantId AND TagId = @tagId");
    return updated.recordset[0];
}

/**
 * Assigns a tag to a conversation.
 */
export async function assignTagToConversation(conversationId: string, tagId: string) {
    const pool = await getPool();
    await pool.request()
        .input("conversationId", conversationId)
        .input("tagId", tagId)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM altdesk.ConversationTag WHERE ConversationId = @conversationId AND TagId = @tagId)
            BEGIN
                INSERT INTO altdesk.ConversationTag (ConversationId, TagId)
                VALUES (@conversationId, @tagId);
            END
        `);
}

/**
 * Removes a tag from a conversation.
 */
export async function removeTagFromConversation(conversationId: string, tagId: string) {
    const pool = await getPool();
    await pool.request()
        .input("conversationId", conversationId)
        .input("tagId", tagId)
        .query("DELETE FROM altdesk.ConversationTag WHERE ConversationId = @conversationId AND TagId = @tagId");
}

export async function deleteTag(tenantId: string, tagId: string) {
    const pool = await getPool();
    // In soft-delete mode, we don't necessarily need to remove from ConversationTag,
    // but we MUST mark the tag as deleted.
    await pool.request()
        .input("tenantId", tenantId)
        .input("tagId", tagId)
        .query("UPDATE altdesk.Tag SET DeletedAt = SYSUTCDATETIME() WHERE TenantId = @tenantId AND TagId = @tagId");
}
