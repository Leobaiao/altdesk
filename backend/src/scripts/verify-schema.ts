
import { getPool } from "../db.js";

async function verify() {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tenant' AND TABLE_SCHEMA = 'omni'
    `);
        console.log("Columns in omni.Tenant:", result.recordset.map((r: any) => r.COLUMN_NAME));
    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        process.exit(0);
    }
}

verify();
