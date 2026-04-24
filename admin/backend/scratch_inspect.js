
import { getPool } from "../../backend/src/db.js";

async function run() {
    try {
        const pool = await getPool();
        const r = await pool.request().query("SELECT * FROM altdesk.ChannelConnector WHERE Provider = 'GTI'");
        console.log("--- GTI CONNECTORS ---");
        r.recordset.forEach(conn => {
            console.log(`ID: ${conn.ConnectorId}`);
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
