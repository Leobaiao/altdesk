import "dotenv/config";
import { getPool } from "../src/db.js";

async function run() {
    try {
        const pool = await getPool();
        
        // Check if PasswordResetToken table exists
        const tableCheck = await pool.request().query(`
            SELECT 1 FROM sys.tables WHERE name = 'PasswordResetToken' AND schema_id = SCHEMA_ID('altdesk')
        `);
        console.log("Table exists:", tableCheck.recordset.length > 0 ? "YES" : "NO");
        
        // Show schema of the table if it exists
        if (tableCheck.recordset.length > 0) {
            const columns = await pool.request().query(`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'PasswordResetToken' AND TABLE_SCHEMA = 'altdesk'
            `);
            console.log("Columns:", columns.recordset);
        }
        
        // Let's test a simple select from the table
        const tokens = await pool.request().query("SELECT TOP 5 * FROM altdesk.PasswordResetToken");
        console.log("Sample tokens:", tokens.recordset);
        
        process.exit(0);
    } catch (err) {
        console.error("Diagnostic failed:", err);
        process.exit(1);
    }
}

run();
