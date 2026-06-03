import "dotenv/config";
import { getPool } from "../src/db.js";

async function run() {
    try {
        const pool = await getPool();
        const res = await pool.request().query(`
            SELECT ContextKey, Title, Content
            FROM altdesk.HelpArticle
            WHERE ContextKey IN ('tickets.index', 'kanban.index') AND DeletedAt IS NULL
        `);
        console.log("Articles content:", JSON.stringify(res.recordset, null, 2));
        process.exit(0);
    } catch (err) {
        console.error("Check failed:", err);
        process.exit(1);
    }
}

run();
