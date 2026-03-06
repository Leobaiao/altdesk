import { getPool } from "../db.js";

async function run() {
    const pool = await getPool();
    try {
        await pool.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.Tenant') AND name = 'DefaultProvider')
      BEGIN
        ALTER TABLE omni.Tenant ADD DefaultProvider NVARCHAR(50) DEFAULT 'GTI';
      END
    `);
        console.log("Migration 006 done");
    } catch (e) {
        console.error(e);
    }
}

run();
