import "dotenv/config";
import pkg from "mssql";
const { connect } = pkg;
import type { ConnectionPool } from "mssql";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { hashPassword } from "../auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  server: process.env.DB_HOST ? process.env.DB_HOST.split(',')[0] : "db",
  port: process.env.DB_HOST && process.env.DB_HOST.includes(',') ? parseInt(process.env.DB_HOST.split(',')[1]) : 1433,
  database: "master", // Connect to master first to create DB if needed
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function runScript(pool: ConnectionPool, filePath: string, replacements: Record<string, string> = {}) {
  console.log(`Reading ${filePath}...`);
  let content = await fs.readFile(filePath, "utf-8");

  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(key, value);
  }

  // Split by GO
  const batches = content
    .split(/\nGO\b/i)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  for (const batch of batches) {
    try {
      await pool.query(batch);
    } catch (e: any) {
      console.error(`Error executing batch:\n${batch.substring(0, 100)}...\nError: ${e.message}`);
      throw e;
    }
  }
  console.log(`Executed ${batches.length} batches from ${path.basename(filePath)}`);
}

async function main() {
  const targetDb = process.env.DB_NAME || "AltDeskDev";
  console.log(`Connecting to SQL Server to reset database: ${targetDb}...`);
  const pool = await connect(config);

  try {
    // 1. Drop and Recreate Database
    console.log(`Dropping and recreating database ${targetDb}...`);
    await pool.query(`
      IF EXISTS (SELECT name FROM sys.databases WHERE name = '${targetDb}')
      BEGIN
        ALTER DATABASE [${targetDb}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${targetDb}];
      END
      CREATE DATABASE [${targetDb}];
    `);

    // 2. Switch to the new database
    await pool.query(`USE [${targetDb}]`);
    console.log(`Switched to database ${targetDb}`);

    // 3. Localizar o diretório db (suporta dev e Docker dist)
    const dbDir = fs.stat(path.resolve(process.cwd(), "db")).then(() => path.resolve(process.cwd(), "db"))
      .catch(() => path.resolve(__dirname, "../../../db")); // Fallback para quando o rootDir preserva a estrutura

    const activeDbDir = await dbDir;
    console.log(`Using database scripts from: ${activeDbDir}`);

    // 4. Init Schema
    const schemaPath = path.resolve(activeDbDir, "01-init.sql");
    await runScript(pool, schemaPath);

    // 5. Init Seed (which contains canned responses and users)
    const passwordHash = await hashPassword("123456");
    const hashHex = passwordHash.toString("hex");

    const seedPath = path.resolve(activeDbDir, "02-seed.sql");
    await runScript(pool, seedPath, {
      "__PASSWORD_HASH__": hashHex
    });

    // 6. Migrations
    const migrationsPath = path.resolve(activeDbDir, "03-migration-roles-cpf-audit.sql");
    await runScript(pool, migrationsPath);

    // Call external scripts for TS migrations
    console.log("Running TS Migrations...");
    const { execSync } = await import("child_process");
    execSync("npx tsx src/scripts/migrate-sla.ts", { stdio: "inherit" });
    execSync("npx tsx src/scripts/migrate-metrics.ts", { stdio: "inherit" });
    execSync("npx tsx src/scripts/migrate-tags.ts", { stdio: "inherit" });
    execSync("npx tsx src/scripts/migrate-knowledge.ts", { stdio: "inherit" });
    execSync("npx tsx src/scripts/migrate-business-hours.ts", { stdio: "inherit" });
    execSync("npx tsx src/scripts/migrate-csat.ts", { stdio: "inherit" });

    console.log("✅ Database reset and seeded successfully!");
  } catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

main();
