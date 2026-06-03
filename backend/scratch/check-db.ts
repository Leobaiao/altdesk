import "dotenv/config";
import { getPool } from "../src/db.js";

async function run() {
    try {
        const pool = await getPool();
        const res = await pool.request().query(`
            SELECT HelpArticleId, TenantId, ContextKey, Title, Category, PagePath, IsActive
            FROM altdesk.HelpArticle
            WHERE DeletedAt IS NULL
        `);
        console.log("Articles in DB:", JSON.stringify(res.recordset, null, 2));
        process.exit(0);
    } catch (err) {
        console.error("Check failed:", err);
        process.exit(1);
    }
}

run();
