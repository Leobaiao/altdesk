import "dotenv/config";
import { getPool } from "../src/db.js";

async function run() {
    try {
        const pool = await getPool();
        const emails = ["leobaiao966@gmail.com", "tgmebarak@hotmail.com"];
        for (const email of emails) {
            const userRes = await pool.request()
                .input("email", email)
                .query("SELECT UserId, Email, IsActive FROM altdesk.[User] WHERE Email = @email");
            console.log(`User query for ${email}:`, userRes.recordset);
        }
        process.exit(0);
    } catch (err) {
        console.error("Query failed:", err);
        process.exit(1);
    }
}

run();
