import "dotenv/config";
import { getPool } from "../db.js";

async function run() {
    const pool = await getPool();
    console.log("Running TrialExtended Migration...");

    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns 
                           WHERE object_id = OBJECT_ID('altdesk.Subscription') 
                           AND name = 'TrialExtended')
            BEGIN
                ALTER TABLE altdesk.Subscription 
                ADD TrialExtended INT NOT NULL DEFAULT 0;
                PRINT 'TrialExtended field added to altdesk.Subscription';
            END
            ELSE
            BEGIN
                PRINT 'TrialExtended field already exists.';
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
