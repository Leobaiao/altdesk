
import "dotenv/config";
import { getPool } from "../db.js";

const API_URL = "http://localhost:3001/api/contacts";
const TOKEN = process.env.API_TOKEN || "d7ef03be-cce7-4725-9ce7-79afa277265b"; // Using logic from env or hardcoded fallback for script

// Not really using token here because I want to hit the API, BUT I need a valid JWT token likely.
// The script `src/index.ts` uses `authMw`.
// I need to login first or use a mocked token if `authMw` accepts it.
// Actually, let's just use `fetch` with the token logic if possible, or bypass API and call logic directly?
// Calling logic directly is safer to debug DB issues.
// But if it's Zod, I need to call API.

import { createContact } from "../services/contact.js";

async function run() {
    console.log("=== Testing Direct DB Insert ===");
    try {
        await createContact("42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D", {
            name: "Test Leo",
            phone: "5511999999999",
            email: "",
            notes: "Test note"
        });
        console.log("✅ Direct DB Insert Success");
    } catch (e: any) {
        console.error("❌ Direct DB Insert Failed:", e.message);
    }

    // Also test raw SQL to see defaults
    const pool = await getPool();
    const schema = await pool.request().query("sp_help 'omni.Contact'");
    // console.log(JSON.stringify(schema.recordsets, null, 2)); 
    // too verbose, let's trust the error message from createContact

    process.exit(0);
}

run();
