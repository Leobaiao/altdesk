import "dotenv/config";
import { getPool } from "../db.js";
import { createTag, listTags, assignTagToConversation } from "../services/tagService.js";
import { listConversations } from "../services/chatService.js";

async function run() {
    try {
        const pool = await getPool();

        // Find a tenant
        const tenantRes = await pool.request().query("SELECT TOP 1 TenantId FROM altdesk.Tenant");
        if (tenantRes.recordset.length === 0) {
            console.log("No tenants found.");
            return;
        }
        const tenantId = tenantRes.recordset[0].TenantId;

        console.log(`Using Tenant: ${tenantId}`);

        // Create a test tag
        const tagName = "TestTag_" + Math.random().toString(36).substring(7);
        const tag = await createTag(tenantId, tagName, "#FF5733");
        console.log("Created Tag:", tag);

        // Find a conversation
        const convRes = await pool.request()
            .input("tenantId", tenantId)
            .query("SELECT TOP 1 ConversationId FROM altdesk.Conversation WHERE TenantId = @tenantId");

        if (convRes.recordset.length === 0) {
            console.log("No conversations found for tenant.");
            return;
        }
        const conversationId = convRes.recordset[0].ConversationId;
        console.log(`Assigning tag to Conversation: ${conversationId}`);

        await assignTagToConversation(conversationId, tag.TagId);
        console.log("Tag assigned.");

        // Verify via listConversations
        const user: any = { userId: "test", tenantId, role: "ADMIN" };
        const conversations = await listConversations(user, 10, 0);

        const ourConv = conversations.find(c => c.ConversationId === conversationId);
        if (ourConv && ourConv.Tags && ourConv.Tags.some((t: any) => t.Name === tagName)) {
            console.log("SUCCESS: Tag found in conversation list!");
            console.log("Tags data:", ourConv.Tags);
        } else {
            console.error("FAILURE: Tag not found in conversation list.");
            console.log("Conversation data:", ourConv);
        }

        process.exit(0);
    } catch (error) {
        console.error("Test failed:", error);
        process.exit(1);
    }
}

run();
