import { getPool } from "../db.js";

async function run() {
    const pool = await getPool();
    try {
        const r = await pool.request().query(`
            SELECT TOP 1 * FROM omni.ChannelConnector
        `);
        console.log(r.recordset);
    } catch (e: any) {
        console.error("SQL_ERROR", e.message);
    }
    process.exit(0);
}

run();
