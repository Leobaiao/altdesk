
import "dotenv/config";
import { getPool } from "../db.js";
import { resolveConversationForInbound } from "../services/conversation.js";

const TENANT_ID = "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D";

async function run() {
    console.log("=== Testing Ticket Lifecycle (Direct DB) ===");

    const pool = await getPool();

    // 1. Ensure Connector Exists
    const anyConn = await pool.request().query(`SELECT TOP 1 ConnectorId, ChannelId FROM omni.ChannelConnector`);
    if (anyConn.recordset.length === 0) throw new Error("No connectors found in DB");

    const { ConnectorId, ChannelId } = anyConn.recordset[0];

    // 2. Ensure Conversation Exists
    console.log("Ensuring conversation exists...");
    const conversationId = await resolveConversationForInbound({
        tenantId: TENANT_ID,
        externalChatId: "5511999998888",
        externalUserId: "5511999998888",
        text: "Lifecycle Test",
        raw: {},
        channel: "WHATSAPP",
        provider: "GTI",
        timestamp: Date.now()
    }, ConnectorId, ChannelId);

    console.log(`✅ Conversation ready: ${conversationId}`);

    // 3. Verify Initial Status (OPEN)
    let res = await pool.request()
        .input("cid", conversationId)
        .query("SELECT Status FROM omni.Conversation WHERE ConversationId = @cid");
    let status = res.recordset[0].Status;

    if (status !== 'OPEN') {
        console.log("Status is not OPEN, resetting...");
        await pool.request()
            .input("cid", conversationId)
            .query("UPDATE omni.Conversation SET Status = 'OPEN' WHERE ConversationId = @cid");
        status = 'OPEN';
    }
    console.log(`✅ Initial status is ${status}`);

    // 4. Resolve (Simulate API logic)
    console.log("Resolving ticket...");
    await pool.request()
        .input("cid", conversationId)
        .input("status", "RESOLVED")
        .query("UPDATE omni.Conversation SET Status = @status WHERE ConversationId = @cid");

    // Verify
    res = await pool.request()
        .input("cid", conversationId)
        .query("SELECT Status FROM omni.Conversation WHERE ConversationId = @cid");
    status = res.recordset[0].Status;
    if (status !== 'RESOLVED') throw new Error(`Status check failed: Expected RESOLVED, got ${status}`);
    console.log("✅ Conversation is now RESOLVED");


    // 5. Reopen (Simulate API logic)
    console.log("Reopening ticket...");
    await pool.request()
        .input("cid", conversationId)
        .input("status", "OPEN")
        .query("UPDATE omni.Conversation SET Status = @status WHERE ConversationId = @cid");

    // Verify
    res = await pool.request()
        .input("cid", conversationId)
        .query("SELECT Status FROM omni.Conversation WHERE ConversationId = @cid");
    status = res.recordset[0].Status;
    if (status !== 'OPEN') throw new Error(`Status check failed: Expected OPEN, got ${status}`);
    console.log("✅ Conversation is back to OPEN");

    console.log("=== ALL TESTS PASSED ===");
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
