import pkg from "mssql";
const { ConnectionPool } = pkg;
import type { config as SqlConfig } from "mssql";

const config: SqlConfig = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  server: process.env.DB_HOST!,
  database: process.env.DB_NAME!,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

let pool: any = null;

export async function getPool() {
  if (pool) return pool;
  try {
    pool = await new ConnectionPool(config).connect();
    return pool;
  } catch (err) {
    console.error("Database connection failed:", err);
    throw err;
  }
}
