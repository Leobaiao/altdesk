
import { getPool } from "../db.js";
import "dotenv/config";

async function run() {
    process.env.DB_HOST = "127.0.0.1";
    console.log("=== Checking Channels & Connectors ===");
    const pool = await getPool();

    const channels = await pool.query("SELECT * FROM omni.Channel");
    console.log("Channels:", channels.recordset);

    const connectors = await pool.query("SELECT * FROM omni.ChannelConnector");
    console.log("Connectors:", connectors.recordset);

    process.exit(0);
}

run();
