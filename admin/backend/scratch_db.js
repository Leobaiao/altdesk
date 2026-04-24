
import sql from "mssql";
import "dotenv/config";

const config = {
    user: "sa",
    password: "Intamr17@",
    database: "AltDeskDev",
    server: "localhost",
    port: 14334,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request().query("SELECT * FROM altdesk.ChannelConnector WHERE Provider = 'GTI'");
        console.log("--- GTI CONNECTORS ---");
        r.recordset.forEach(conn => {
            console.log(`ID: ${conn.ConnectorId}`);
            const cfg = JSON.parse(conn.ConfigJson);
            console.log(`BaseURL: ${cfg.baseUrl || 'DEFAULT'}`);
            console.log(`Config: ${conn.ConfigJson}`);
            console.log("----------------------");
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
