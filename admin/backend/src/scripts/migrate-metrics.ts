import sql from "mssql";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

// Match db.ts logic exactly
const rawHost = process.env.DB_HOST || "localhost";
const hostParts = rawHost.split(",");
const server = hostParts[0];
const port = hostParts[1] ? parseInt(hostParts[1], 10) : (process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433);

const config = {
    user: process.env.DB_USER!,
    password: process.env.DB_PASS!,
    server,
    port,
    database: process.env.DB_NAME!,
    options: {
        encrypt: false, // Match db.ts
        trustServerCertificate: true,
    },
};

async function migrate() {
    try {
        console.log(`Connecting to ${server}:${port}...`);
        const pool = await sql.connect(config);
        console.log("Connected to database");

        // Add ClosedAt and CsatScore to Conversation
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'ClosedAt')
            BEGIN
                ALTER TABLE altdesk.Conversation ADD ClosedAt DATETIME NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'CsatScore')
            BEGIN
                ALTER TABLE altdesk.Conversation ADD CsatScore INT NULL;
            END
        `);
        console.log("Fields ClosedAt and CsatScore added to altdesk.Conversation");

        // Backfill ClosedAt for existing RESOLVED conversations
        await pool.request().query(`
            UPDATE altdesk.Conversation 
            SET ClosedAt = ISNULL(LastMessageAt, CreatedAt)
            WHERE Status = 'RESOLVED' AND ClosedAt IS NULL
        `);
        console.log("Backfilled ClosedAt for existing RESOLVED conversations");

        await pool.close();
        console.log("Migration completed");
    } catch (err) {
        console.error("Migration failed:", err);
    }
}

migrate();
