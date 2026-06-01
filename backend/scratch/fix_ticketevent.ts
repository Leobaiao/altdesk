import pkg from 'mssql';
const { connect } = pkg;
import 'dotenv/config';

async function run() {
    const config = {
        user: 'sa',
        password: process.env.DB_PASSWORD || "",
        server: 'localhost',
        port: 14334,
        database: 'AltDeskDev',
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };
    try {
        const pool = await connect(config);
        console.log("Connected to DB");
        
        // Check if TenantId exists
        const check = await pool.query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.TicketEvent') AND name = 'TenantId'`);
        if (check.recordset.length === 0) {
            console.log("Adding TenantId to TicketEvent...");
            await pool.query(`ALTER TABLE altdesk.TicketEvent ADD TenantId UNIQUEIDENTIFIER NULL`);
            await pool.query(`UPDATE altdesk.TicketEvent SET TenantId = (SELECT TOP 1 TenantId FROM altdesk.Ticket WHERE Ticket.TicketId = TicketEvent.TicketId)`);
            // Fill any remaining with a default if needed, but usually tickets exist
            await pool.query(`ALTER TABLE altdesk.TicketEvent ALTER COLUMN TenantId UNIQUEIDENTIFIER NOT NULL`);
            console.log("Column added and updated.");
        } else {
            console.log("TenantId already exists in TicketEvent.");
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
