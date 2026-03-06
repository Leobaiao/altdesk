
import "dotenv/config";
import { getPool } from "../db.js";

async function run() {
    console.log("=== Updating Connector Config ===");
    const pool = await getPool();

    const config = JSON.stringify({
        baseUrl: "https://api.gtiapi.workers.dev",
        token: process.env.API_TOKEN ?? "d7ef03be-cce7-4725-9ce7-79afa277265b",
        instance: "dev"
    });

    await pool.request()
        .input("config", config)
        .query("UPDATE omni.ChannelConnector SET ConfigJson = @config WHERE ConnectorId = 'whatsapp-gti-dev'");

    console.log("✅ Connector updated with token:", process.env.API_TOKEN);
    process.exit(0);
}

run().catch(console.error);
