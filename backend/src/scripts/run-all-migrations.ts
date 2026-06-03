import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pkg from "mssql";
const { connect } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const config = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASS || process.env.MSSQL_SA_PASSWORD || "",
  server: process.env.DB_HOST ? process.env.DB_HOST.split(',')[0] : "db",
  port: process.env.DB_HOST && process.env.DB_HOST.includes(',') ? parseInt(process.env.DB_HOST.split(',')[1]) : 1433,
  database: process.env.DB_NAME || "AltDeskDev",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// Check if we are running in the dist folder
const isDist = __dirname.includes("dist");
const ext = isDist ? ".js" : ".ts";
const runner = isDist ? "node" : "npx tsx";

// Scripts to run in order
const scripts = [
  "migrate-sla",
  "migrate-metrics",
  "migrate-tags",
  "migrate-knowledge",
  "migrate-business-hours",
  "migrate-csat",
  "migrate-help-articles",
  "migrate-default-page",
  "migrate-audit-log",
  "migrate-exceptions"
];

async function waitForSqlMigrations(maxAttempts = 40, delayMs = 3000) {
  console.log("Checking if SQL database migrations are completed...");
  let pool = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      pool = await connect(config);
      const checkTable = await pool.request().query(`
        SELECT 1 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'altdesk' AND TABLE_NAME = 'Ticket' AND COLUMN_NAME = 'ResolutionDescription'
      `);
      if (checkTable.recordset.length > 0) {
        console.log("✅ SQL migrations are completed. Starting TS migrations...");
        await pool.close();
        return;
      }
      console.log(`[Attempt ${attempt}/${maxAttempts}] SQL migrations not completed yet. Waiting...`);
    } catch (err: any) {
      console.log(`[Attempt ${attempt}/${maxAttempts}] Database not ready or connecting failed: ${err.message}. Waiting...`);
    } finally {
      if (pool) {
        try { await pool.close(); } catch {}
        pool = null;
      }
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  console.error("❌ Timeout waiting for SQL migrations to finish.");
  process.exit(1);
}

async function run() {
  // Wait for SQL migrations to complete first
  await waitForSqlMigrations();

  console.log(`Starting TS database migrations (Environment: ${isDist ? "Production/Built" : "Development"})...`);
  for (const script of scripts) {
    const scriptPath = path.resolve(__dirname, `${script}${ext}`);
    if (fs.existsSync(scriptPath)) {
      console.log(`Running migration: ${script}`);
      try {
        execSync(`${runner} "${scriptPath}"`, { stdio: "inherit" });
      } catch (err) {
        console.error(`Migration ${script} failed:`, err);
        process.exit(1);
      }
    } else {
      console.warn(`Migration script not found: ${scriptPath}`);
    }
  }
  console.log("All TS migrations executed successfully.");
}

run();
