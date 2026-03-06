import { getPool } from './dist/backend/src/db.js';

async function main() {
    try {
        const pool = await getPool();

        // Find the conversation
        const convRes = await pool.query("SELECT TOP 1 ConversationId, TenantId FROM omni.Conversation WHERE Title LIKE '%leo%'");
        if (convRes.recordset.length === 0) {
            console.error('Conversation not found');
            process.exit(1);
        }
        const { ConversationId, TenantId } = convRes.recordset[0];

        // Find connector
        const connRes = await pool.query("SELECT TOP 1 ConnectorId FROM omni.ChannelConnector WHERE Provider = 'GTI' AND IsActive = 1");
        if (connRes.recordset.length === 0) {
            console.error('Active GTI connector not found');
            process.exit(1);
        }
        const connectorId = connRes.recordset[0].ConnectorId;
        const phone = '5511976131029@s.whatsapp.net';

        console.log(`Linking ${ConversationId} to ${connectorId}...`);

        await pool.request()
            .input("tenantId", TenantId)
            .input("connectorId", connectorId)
            .input("externalId", phone)
            .input("conversationId", ConversationId)
            .query(`
                DELETE FROM omni.ExternalThreadMap WHERE ConversationId = @conversationId;
                
                INSERT INTO omni.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                VALUES (@tenantId, @connectorId, @externalId, @externalId, @conversationId);
            `);

        console.log('Success!');
        process.exit(0);
    } catch (err) {
        console.error('Fail:', err);
        process.exit(1);
    }
}

main();
