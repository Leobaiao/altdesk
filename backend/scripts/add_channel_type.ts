
import { sql, getPool } from "../src/db";

async function main() {
    try {
        const pool = await getPool();
        console.log("Adding Type column to altdesk.Channel...");

        await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('altdesk.Channel') AND name = 'Type'
      )
      BEGIN
        ALTER TABLE altdesk.Channel ADD Type NVARCHAR(50) NOT NULL DEFAULT 'MESSAGING';
        PRINT 'Column Type added to altdesk.Channel';
      END
      ELSE
      BEGIN
        PRINT 'Column Type already exists in altdesk.Channel';
      END
    `);

        console.log("Migration completed.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

main();
