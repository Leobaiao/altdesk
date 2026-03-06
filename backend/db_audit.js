import { getPool } from './dist/backend/src/db.js';

async function main() {
    try {
        const pool = await getPool();
        const convs = await pool.query('SELECT ConversationId, Title FROM omni.Conversation');
        const etm = await pool.query('SELECT * FROM omni.ExternalThreadMap');
        const conn = await pool.query('SELECT ConnectorId, Provider FROM omni.ChannelConnector');

        console.log('--- CONVERSATIONS ---');
        console.log(JSON.stringify(convs.recordset, null, 2));
        console.log('--- EXTERNAL THREAD MAP ---');
        console.log(JSON.stringify(etm.recordset, null, 2));
        console.log('--- CONNECTORS ---');
        console.log(JSON.stringify(conn.recordset, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Audit failed:', err);
        process.exit(1);
    }
}

main();
