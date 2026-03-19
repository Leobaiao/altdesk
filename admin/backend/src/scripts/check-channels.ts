
import { getPool } from "../db.js";
import "dotenv/config";

async function run() {
    process.env.DB_HOST = "127.0.0.1";
    console.log("=== Checking Channels & Connectors ===");
    const pool = await getPool();

    const channels = await pool.query("SELECT * FROM altdesk.Channel");
    console.log("Channels:", channels.recordset);

    const connectors = await pool.query("SELECT * FROM altdesk.ChannelConnector");
    console.log("Connectors:", connectors.recordset);

    process.exit(0);
}

run();
