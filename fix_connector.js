import { getPool } from './dist/backend/src/db.js';

async function main() {
    try {
        const pool = await getPool();
        const res = await pool.query("UPDATE omni.ChannelConnector SET ConnectorId = '71E43B61-9C2E-4E8F-97F5-E0D6B38A4727' WHERE ConnectorId = '47A71F87-BDF8-4A72-9CDD-58BDC129B8FA'");
        console.log('Update result:', res.rowsAffected);
        process.exit(0);
    } catch (err) {
        console.error('Update failed:', err);
        process.exit(1);
    }
}

main();
