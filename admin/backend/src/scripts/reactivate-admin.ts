import { getPool } from "../db.js";

async function run() {
    const pool = await getPool();
    try {
        const r = await pool.request().query(`
            UPDATE altdesk.[User] SET IsActive = 1 WHERE Role = 'SUPERADMIN' AND Email = 'leobaiao966@gmail.com';
            UPDATE altdesk.Agent SET IsActive = 1 WHERE UserId IN (SELECT UserId FROM altdesk.[User] WHERE Role = 'SUPERADMIN' AND Email = 'leobaiao966@gmail.com');
        `);
        console.log("Account Reactivated successfully.");
    } catch (e: any) {
        console.error("SQL_ERROR", e.message);
    }
    process.exit(0);
}

run();
