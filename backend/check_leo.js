import { getPool } from './dist/backend/src/db.js';

async function main() {
    try {
        const pool = await getPool();
        const res = await pool.query("SELECT ConversationId, Title FROM omni.Conversation WHERE Title LIKE '%leo%'");
        console.log('Conversations matching leo:', res.recordset);

        if (res.recordset.length > 0) {
            const ids = res.recordset.map(c => `'${c.ConversationId}'`).join(',');
            const mapRes = await pool.query(`SELECT * FROM omni.ExternalThreadMap WHERE ConversationId IN (${ids})`);
            console.log('ExternalThreadMap for these ids:', mapRes.recordset);
        }

        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
}

main();
