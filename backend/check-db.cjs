
const sql = require("mssql");

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST || "db",
    database: "OmniChatDev",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function verify() {
    try {
        console.log("Connecting...");
        await sql.connect(config);

        console.log("--- Checking omni.Tenant ---");
        const tCols = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tenant' AND TABLE_SCHEMA = 'omni'");
        console.log("Columns:", tCols.recordset.map(r => r.COLUMN_NAME));

        console.log("--- Checking omni.Contact ---");
        const cCols = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Contact' AND TABLE_SCHEMA = 'omni'");
        console.log("Columns:", cCols.recordset.map(r => r.COLUMN_NAME));

        console.log("--- Trying INSERT omni.Contact ---");
        const tenantId = "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D"; // Dev tenant
        try {
            await sql.query(`
            INSERT INTO omni.Contact (TenantId, Name, Phone, Email, Tags, Notes)
            VALUES ('${tenantId}', 'Test Script', '123456789', 'test@script.com', '[]', 'Created by script')
        `);
            console.log("INSERT SUCCESS");

            // Clean up
            await sql.query(`DELETE FROM omni.Contact WHERE Phone = '123456789'`);
        } catch (err) {
            console.error("INSERT FAILED:", err.message);
        }

    } catch (err) {
        console.error("Connection/Query failed:", err);
    } finally {
        process.exit(0);
    }
}

verify();
