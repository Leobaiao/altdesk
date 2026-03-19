import { getPool } from "../db.js";

/**
 * Lists all tags for a tenant.
 */
export async function listTags(tenantId: string) {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT TagId, Name, Color FROM altdesk.Tag WHERE TenantId = @tenantId ORDER BY Name");
    return r.recordset;
}

/**
 * Creates a new tag.
 */
export async function createTag(tenantId: string, name: string, color: string) {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .input("name", name)
        .input("color", color)
        .query(`
            INSERT INTO altdesk.Tag (TenantId, Name, Color)
            VALUES (@tenantId, @name, @color);
            SELECT SCOPE_IDENTITY() AS Id; -- Note: TagId is GUID so this won't work as expected for GUIDs, but we usually return the object
        `);
    // Improved query to return the created tag
    const created = await pool.request()
        .input("tenantId", tenantId)
        .input("name", name)
        .query("SELECT TOP 1 TagId, Name, Color FROM altdesk.Tag WHERE TenantId = @tenantId AND Name = @name ORDER BY CreatedAt DESC");
    return created.recordset[0];
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

/**
 * Deletes a tag entirely.
 */
export async function deleteTag(tenantId: string, tagId: string) {
    const pool = await getPool();
    // First remove from all conversations
    await pool.request().input("tagId", tagId).query("DELETE FROM altdesk.ConversationTag WHERE TagId = @tagId");
    // Then delete the tag
    await pool.request()
        .input("tenantId", tenantId)
        .input("tagId", tagId)
        .query("DELETE FROM altdesk.Tag WHERE TenantId = @tenantId AND TagId = @tagId");
}
