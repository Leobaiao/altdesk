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
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('altdesk.BusinessHours') AND type = 'U')
            BEGIN
                CREATE TABLE altdesk.BusinessHours (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    TenantId UNIQUEIDENTIFIER NOT NULL REFERENCES altdesk.Tenant(TenantId),
                    DayOfWeek INT NOT NULL CHECK (DayOfWeek BETWEEN 0 AND 6),
                    StartTime TIME NOT NULL DEFAULT '08:00',
                    EndTime TIME NOT NULL DEFAULT '18:00',
                    IsActive BIT NOT NULL DEFAULT 1,
                    UNIQUE (TenantId, DayOfWeek)
                );
            END
        `);
        console.log("Table altdesk.BusinessHours created");

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'OffHoursMessage')
            BEGIN
                ALTER TABLE altdesk.Tenant ADD OffHoursMessage NVARCHAR(500) NULL;
            END
        `);
        console.log("Field OffHoursMessage added to altdesk.Tenant");

        await pool.close();
        console.log("Migration completed");
    } catch (err) {
        console.error("Migration failed:", err);
    }
}

migrate();
