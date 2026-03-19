import { getPool } from "../db.js";

async function run() {
    const pool = await getPool();
    try {
        await pool.request().query(`
            IF COL_LENGTH('altdesk.ChannelConnector', 'DeletedAt') IS NULL
            BEGIN
                ALTER TABLE altdesk.ChannelConnector ADD DeletedAt DATETIME2 NULL;
            END
        `);
        console.log("DeletedAt column added successfully.");
    } catch (e: any) {
        console.error("SQL_ERROR", e.message);
    }
    process.exit(0);
}

run();
