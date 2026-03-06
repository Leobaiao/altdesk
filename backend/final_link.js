import { getPool } from './dist/backend/src/db.js';

async function main() {
    try {
        const pool = await getPool();
        const dbInfo = await pool.query("SELECT db_name() as db, @@SERVERNAME as server");
        console.log('Connected to:', dbInfo.recordset[0]);

        const convRes = await pool.query("SELECT ConversationId, TenantId FROM omni.Conversation WHERE Title LIKE '%leo%'");
        if (convRes.recordset.length === 0) {
            console.log('No leo conversation found');
            process.exit(0);
        }

        const c = convRes.recordset[0];
        const connRes = await pool.query("SELECT ConnectorId FROM omni.ChannelConnector WHERE Provider = 'GTI' AND IsActive = 1");
        const connectorId = connRes.recordset[0].ConnectorId;
        const phone = '5511976131029@s.whatsapp.net';

        console.log(`Linking ${c.ConversationId} to ${connectorId}...`);

        const query = `
            DELETE FROM omni.ExternalThreadMap WHERE ConversationId = '${c.ConversationId}';
            INSERT INTO omni.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
            VALUES ('${c.TenantId}', '${connectorId}', '${phone}', '${phone}', '${c.ConversationId}');
        `;

        await pool.query(query);
        console.log('Done.');

        const verify = await pool.query(`SELECT * FROM omni.ExternalThreadMap WHERE ConversationId = '${c.ConversationId}'`);
        console.log('Verification:', verify.recordset);

        process.exit(0);
    } catch (err) {
        console.error('Final check failed:', err);
        process.exit(1);
    }
}

main();
