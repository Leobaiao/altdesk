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

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('altdesk.BusinessDayException') AND type = 'U')
            BEGIN
                CREATE TABLE altdesk.BusinessDayException (
                    ExceptionId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                    TenantId UNIQUEIDENTIFIER NOT NULL REFERENCES altdesk.Tenant(TenantId),
                    Date DATE NOT NULL,
                    Description NVARCHAR(200),
                    IsOpen BIT NOT NULL DEFAULT 0,
                    StartTime TIME NULL,
                    EndTime TIME NULL,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    UNIQUE (TenantId, Date)
                );
            END
        `);
        console.log("Table altdesk.BusinessDayException created");

        await pool.close();
        console.log("Migration completed");
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
