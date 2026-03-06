
import { sql, getPool } from "../src/db";

async function main() {
    try {
        const pool = await getPool();
        console.log("Adding Type column to omni.Channel...");

        await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('omni.Channel') AND name = 'Type'
      )
      BEGIN
        ALTER TABLE omni.Channel ADD Type NVARCHAR(50) NOT NULL DEFAULT 'MESSAGING';
        PRINT 'Column Type added to omni.Channel';
      END
      ELSE
      BEGIN
        PRINT 'Column Type already exists in omni.Channel';
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
