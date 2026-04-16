import "dotenv/config";
import pkg from "mssql";
const { connect } = pkg;
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  server: process.env.DB_HOST ? process.env.DB_HOST.split(',')[0] : "db",
  port: process.env.DB_HOST && process.env.DB_HOST.includes(',') ? parseInt(process.env.DB_HOST.split(',')[1]) : 1433,
  database: process.env.DB_NAME || "AltDeskDev",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function main() {
  console.log("Connecting to SQL Server for custom roles migration...");
  const pool = await connect(config);

  try {
    const sqlPath = path.resolve(__dirname, "../../db/16-permissions-and-nomenclature.sql");
    console.log(`Reading migration script from ${sqlPath}...`);
    const content = await fs.readFile(sqlPath, "utf-8");

    const batches = content
      .split(/\nGO\b/i)
      .map(b => b.trim())
      .filter(b => b.length > 0);

    for (const batch of batches) {
      console.log(`Executing batch: ${batch.substring(0, 50)}...`);
      await pool.query(batch);
    }

    console.log("✅ Migration '16-permissions-and-nomenclature' finished successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

main();
