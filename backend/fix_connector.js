import { getPool } from './dist/backend/src/db.js';

async function main() {
    try {
        const pool = await getPool();
        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            console.log('Cleaning up ExternalThreadMap...');
            await transaction.request().query("DELETE FROM omni.ExternalThreadMap");

            console.log('Updating ChannelConnector ID...');
            await transaction.request().query("UPDATE omni.ChannelConnector SET ConnectorId = '71E43B61-9C2E-4E8F-97F5-E0D6B38A4727' WHERE ConnectorId = '47A71F87-BDF8-4A72-9CDD-58BDC129B8FA'");

            await transaction.commit();
            console.log('Update successful!');
            process.exit(0);
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('Update failed:', err);
        process.exit(1);
    }
}

main();
