import pkg from "mssql";
const { ConnectionPool } = pkg;
import type { config as SqlConfig } from "mssql";
import { logger } from "./lib/logger.js";

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
  },
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

let pool: pkg.ConnectionPool | null = null;
let isReconnecting = false;

/**
 * Returns a healthy connection pool, reconnecting automatically if needed.
 * Retries up to 3 times with exponential backoff on initial connection.
 */
export async function getPool(): Promise<pkg.ConnectionPool> {
  // If pool exists and is connected, return it
  if (pool && pool.connected) return pool;

  // If pool exists but is NOT connected, clean it up
  if (pool && !pool.connected) {
    logger.warn("[DB] Pool disconnected, attempting reconnection...");
    try { await pool.close(); } catch { /* ignore close errors */ }
    pool = null;
  }

  // Prevent concurrent reconnection attempts
  if (isReconnecting) {
    // Wait briefly and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (pool && pool.connected) return pool;
    throw new Error("Database reconnection in progress, please retry.");
  }

  isReconnecting = true;
  const MAX_RETRIES = 3;

  try {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const newPool = new ConnectionPool(config);

        // Listen for unexpected errors to trigger reconnection on next getPool() call
        newPool.on("error", (err) => {
          logger.error({ err }, "[DB] Pool error detected, will reconnect on next request");
          pool = null;
        });

        await newPool.connect();
        pool = newPool;
        logger.info({ server, port, database: config.database, attempt }, "[DB] Connection pool established");
        return pool;
      } catch (err) {
        logger.error({ err, attempt, maxRetries: MAX_RETRIES }, `[DB] Connection attempt ${attempt}/${MAX_RETRIES} failed`);
        if (attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }
    throw new Error("Unreachable");
  } finally {
    isReconnecting = false;
  }
}
