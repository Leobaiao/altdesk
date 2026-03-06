import { getPool } from "../db.js";

/**
 * Checks for conversations that have exceeded their SLA deadline without a response.
 * Groups them by tenant if necessary for alerts (future implementation).
 */
export async function checkSlaViolations() {
    const pool = await getPool();
    try {
        const result = await pool.request().query(`
      UPDATE altdesk.Conversation
      SET SlaStatus = 'VIOLATED'
      OUTPUT inserted.ConversationId, inserted.TenantId
      WHERE Status = 'OPEN' 
        AND SlaStatus = 'PENDING' 
        AND SlaDeadline < SYSUTCDATETIME();
    `);

        if (result.recordset.length > 0) {
            console.log(`[SLA] Detected and flagged ${result.recordset.length} violations.`);
            // Future: Trigger notifications, emit socket events, etc.
        }
    } catch (err) {
        console.error("[SLA] Error checking violations:", err);
    }
}

/**
 * Starts the periodic SLA background worker.
 */
export function startSlaWorker(intervalMs: number = 60000) {
    console.log(`[SLA] Worker started (Interval: ${intervalMs}ms)`);
    setInterval(checkSlaViolations, intervalMs);
}
