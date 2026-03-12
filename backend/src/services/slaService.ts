import { getPool } from "../db.js";
import { logger } from "../lib/logger.js";
import { writeAuditLog } from "./auditLog.js";

/**
 * Checks for conversations that have exceeded their SLA deadline without a response.
 * Flags them as VIOLATED and records in AuditLog for traceability.
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
            logger.warn(
                { count: result.recordset.length },
                `[SLA] ${result.recordset.length} violation(s) detected`
            );

            // Registrar cada violação no AuditLog para rastreabilidade
            for (const row of result.recordset) {
                await writeAuditLog({
                    tenantId: row.TenantId,
                    action: "SLA_VIOLATED",
                    targetTable: "Conversation",
                    targetId: row.ConversationId,
                    afterValues: { slaStatus: "VIOLATED", detectedAt: new Date().toISOString() }
                }).catch(err => logger.error({ err, conversationId: row.ConversationId }, "[SLA] Failed to write audit log"));
            }
        } else {
            logger.debug({}, "[SLA] No violations found");
        }
    } catch (err) {
        logger.error({ err }, "[SLA] Error checking violations");
    }
}

/**
 * Starts the periodic SLA background worker.
 */
export function startSlaWorker(intervalMs: number = 60000) {
    logger.info({ intervalMs }, "[SLA] Worker started");
    setInterval(checkSlaViolations, intervalMs);
}
