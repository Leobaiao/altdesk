import sql from "mssql";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

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
    options: { encrypt: false, trustServerCertificate: true },
};

async function migrate() {
    try {
        console.log(`Connecting to ${server}:${port}...`);
        const pool = await sql.connect(config);
        console.log("Connected to database");

        // Create SatisfactionRating table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('altdesk.SatisfactionRating') AND type = 'U')
            BEGIN
                CREATE TABLE altdesk.SatisfactionRating (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    ConversationId UNIQUEIDENTIFIER NOT NULL REFERENCES altdesk.Conversation(ConversationId),
                    Score INT NOT NULL CHECK (Score BETWEEN 1 AND 5),
                    Comment NVARCHAR(1000) NULL,
                    CreatedAt DATETIME DEFAULT GETUTCDATE()
                );
            END
        `);
        console.log("Table altdesk.SatisfactionRating created");

        // Add CsatScore to Conversation
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'CsatScore')
            BEGIN
                ALTER TABLE altdesk.Conversation ADD CsatScore INT NULL;
            END
        `);
        console.log("Field CsatScore added to altdesk.Conversation");

        // Add EnableCsat to Tenant
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'EnableCsat')
            BEGIN
                ALTER TABLE altdesk.Tenant ADD EnableCsat BIT NOT NULL DEFAULT 0;
            END
        `);
        console.log("Field EnableCsat added to altdesk.Tenant");

        await pool.close();
        console.log("Migration completed");
    } catch (err) {
        console.error("Migration failed:", err);
    }
}

migrate();
