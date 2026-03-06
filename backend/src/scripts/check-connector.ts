
import "dotenv/config";
import { getPool } from "../db.js";

async function run() {
    console.log("=== Checking Connectors ===");
    const pool = await getPool();
    const r = await pool.request().query("SELECT * FROM omni.ChannelConnector");
    console.log(JSON.stringify(r.recordset, null, 2));
    process.exit(0);
}

run().catch(console.error);
