import "dotenv/config";
import { getPool } from "../src/db.js";

async function run() {
    const pool = await getPool();
    console.log("Running Tags Alter Migration...");

    try {
        await pool.request().query(`
            IF COL_LENGTH('altdesk.Tag', 'Description') IS NULL
            BEGIN
                ALTER TABLE altdesk.Tag ADD Description NVARCHAR(1000) NOT NULL DEFAULT '';
                PRINT 'Column Description added to altdesk.Tag.';
            END
            ELSE
            BEGIN
                PRINT 'Column Description already exists.';
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
