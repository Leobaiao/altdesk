
import "dotenv/config";
import { getPool } from "../db.js";

async function run() {
    console.log("=== Verifying Promo Template ===");
    const pool = await getPool();

    // Check Template
    const t = await pool.request().query("SELECT * FROM omni.Template WHERE Name = 'Promo'");
    console.log(`Template 'Promo': ${t.recordset.length > 0 ? '✅ FOUND' : '❌ NOT FOUND'}`);

    // Check Message
    const m = await pool.request().query("SELECT TOP 1 * FROM omni.Message WHERE Body LIKE '%Hello John, discount code: 123%'");
    console.log(`Message 'Hello John...': ${m.recordset.length > 0 ? '✅ FOUND' : '❌ NOT FOUND'}`);

    process.exit(0);
}

run().catch(console.error);
