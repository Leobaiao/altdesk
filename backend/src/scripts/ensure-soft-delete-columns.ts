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

const TABLES = [
    "altdesk.Contact",
    "altdesk.Queue",
    "altdesk.CannedResponse",
    "altdesk.KnowledgeArticle",
    "altdesk.ChannelConnector",
    "altdesk.Agent",
    "altdesk.[User]",
    "altdesk.Tenant",
    "altdesk.Channel",
    "altdesk.Conversation",
    "altdesk.Message",
    "altdesk.Ticket"
];

async function migrate() {
    try {
        console.log(`Connecting to ${server}:${port}...`);
        const pool = await sql.connect(config);
        console.log("Connected to database");

        for (const tableName of TABLES) {
            const schemaTable = tableName.split('.');
            const schema = schemaTable[0];
            const table = schemaTable[1].replace('[', '').replace(']', '');

            const checkQuery = `
                IF COL_LENGTH('${tableName}', 'DeletedAt') IS NULL
                BEGIN
                    ALTER TABLE ${tableName} ADD DeletedAt DATETIME2 NULL;
                    PRINT 'Column DeletedAt added to ${tableName}';
                END
                ELSE
                BEGIN
                    PRINT 'Column DeletedAt already exists in ${tableName}';
                END
            `;
            
            await pool.request().query(checkQuery);
        }

        await pool.close();
        console.log("Migration completed successfully");
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
