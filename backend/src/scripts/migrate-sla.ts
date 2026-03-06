import "dotenv/config";
import { getPool } from "../db.js";

async function run() {
    const pool = await getPool();
    console.log("Running SLA Migration...");

    try {
        await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns 
                     WHERE object_id = OBJECT_ID('altdesk.Conversation') 
                     AND name = 'SlaDeadline')
      BEGIN
        ALTER TABLE altdesk.Conversation 
        ADD SlaDeadline DATETIME2 NULL,
            FirstResponseAt DATETIME2 NULL,
            SlaStatus NVARCHAR(20) NULL;
        PRINT 'SLA fields added to altdesk.Conversation';
      END
      ELSE
      BEGIN
        PRINT 'SLA fields already exist.';
      END
    `);
        console.log("Migration finished successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

run();
