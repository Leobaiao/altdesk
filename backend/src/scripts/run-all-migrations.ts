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

/**
 * Wait for the database to be reachable before running TS migrations.
 * The deploy workflow guarantees SQL migrations have already completed
 * before the backend container starts, so we only need to verify connectivity.
 */
async function waitForDatabase(maxAttempts = 15, delayMs = 2000) {
  console.log("Verifying database connectivity...");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let pool = null;
    try {
      pool = await connect(config);
      await pool.request().query("SELECT 1");
      console.log("✅ Database connection verified.");
      await pool.close();
      return;
    } catch (err: any) {
      console.log(`[Attempt ${attempt}/${maxAttempts}] Database not reachable: ${err.message}. Retrying in ${delayMs / 1000}s...`);
    } finally {
      if (pool) {
        try { await pool.close(); } catch {}
      }
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  console.error("❌ Could not connect to the database after all retries.");
  process.exit(1);
}

async function run() {
  // Wait for database connectivity (not for specific migrations — deploy workflow handles ordering)
  await waitForDatabase();

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
