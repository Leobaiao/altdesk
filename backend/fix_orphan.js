import { getPool } from './dist/backend/src/db.js';

async function main() {
    try {
        const pool = await getPool();

        // 1. Find the orphaned conversation
        const convRes = await pool.query("SELECT TOP 1 ConversationId, TenantId FROM omni.Conversation WHERE Title LIKE '%leo%'");
        if (convRes.recordset.length === 0) {
            console.error('Conversation not found');
            process.exit(1);
        }

        const { ConversationId, TenantId } = convRes.recordset[0];

        // Find the active connector
        const connRes = await pool.query("SELECT TOP 1 ConnectorId FROM omni.ChannelConnector WHERE Provider = 'GTI' AND IsActive = 1");
        if (connRes.recordset.length === 0) {
            console.error('Active GTI connector not found');
            process.exit(1);
        }
        const connectorId = connRes.recordset[0].ConnectorId;
        const externalId = '5511976131029@s.whatsapp.net';

        console.log(`Linking Conversation ${ConversationId} to Connector ${connectorId} for user ${externalId}...`);

        // 2. Insert into ExternalThreadMap
        await pool.request()
            .input("tenantId", TenantId)
            .input("connectorId", connectorId)
            .input("externalChatId", externalId)
            .input("externalUserId", externalId)
            .input("conversationId", ConversationId)
            .query(`
                MERGE omni.ExternalThreadMap AS target
                USING (SELECT @conversationId AS ConversationId) AS source
                ON (target.ConversationId = source.ConversationId)
                WHEN MATCHED THEN
                    UPDATE SET ConnectorId = @connectorId, ExternalChatId = @externalChatId, ExternalUserId = @externalUserId
                WHEN NOT MATCHED THEN
                    INSERT (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, @connectorId, @externalChatId, @externalUserId, @conversationId);
            `);

        console.log('Operation completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Fix failed:', err);
        process.exit(1);
    }
}

main();
