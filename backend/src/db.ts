import pkg from "mssql";
const { ConnectionPool } = pkg;
import type { config as SqlConfig } from "mssql";

// Support DB_HOST=host,port format or separate DB_PORT
const rawHost = process.env.DB_HOST || "localhost";
const hostParts = rawHost.split(",");
const server = hostParts[0];
const port = hostParts[1] ? parseInt(hostParts[1], 10) : (process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433);

const config: SqlConfig = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  server,
  port,
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
