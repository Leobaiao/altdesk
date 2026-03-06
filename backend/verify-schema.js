
import sql from "mssql";

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
        const result = await sql.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tenant' AND TABLE_SCHEMA = 'omni'
    `);
        console.log("Columns in omni.Tenant:", result.recordset.map(r => r.COLUMN_NAME));
    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        process.exit(0);
    }
}

verify();
