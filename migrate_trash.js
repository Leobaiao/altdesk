import sql from "mssql";
import { getPool } from "./backend/src/db.js";
import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

async function addDeletedAtColumns() {
    try {
        const pool = await getPool();
        console.log("Adding DeletedAt to User table...");
        try {
            await pool.request().query("ALTER TABLE altdesk.[User] ADD DeletedAt DATETIME NULL");
        } catch (e) { console.log("User.DeletedAt might already exist."); }
        
        console.log("Adding DeletedAt to Tenant table...");
        try {
            await pool.request().query("ALTER TABLE altdesk.Tenant ADD DeletedAt DATETIME NULL");
        } catch (e) { console.log("Tenant.DeletedAt might already exist."); }
        
        console.log("Done.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
addDeletedAtColumns();
