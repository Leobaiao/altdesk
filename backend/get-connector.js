
const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: "127.0.0.1",
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        await sql.connect(config);
        const res = await sql.query("SELECT ConnectorId FROM omni.ChannelConnector WHERE Provider='WEBCHAT'");
        console.log("CONNECTOR_ID:", res.recordset[0]?.ConnectorId);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
