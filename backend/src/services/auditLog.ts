import { getPool } from "../db.js";
import { logger } from "../lib/logger.js";

export interface AuditLogEntry {
  tenantId?: string;
  userId?: string;
  action: string;
  targetTable?: string;
  targetId?: string;
  beforeValues?: Record<string, any> | null;
  afterValues?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Grava uma entrada no log de auditoria.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const pool = await getPool();
    await pool.request()
      .input("tenantId", entry.tenantId ?? null)
      .input("userId", entry.userId ?? null)
      .input("action", entry.action)
      .input("targetTable", entry.targetTable ?? null)
      .input("targetId", entry.targetId ?? null)
      .input("beforeValues", entry.beforeValues ? JSON.stringify(entry.beforeValues) : null)
      .input("afterValues", entry.afterValues ? JSON.stringify(entry.afterValues) : null)
      .input("ipAddress", entry.ipAddress ?? null)
      .input("userAgent", entry.userAgent ?? null)
      .query(`
        INSERT INTO altdesk.AuditLog (TenantId, UserId, Action, TargetTable, TargetId, BeforeValues, AfterValues, IpAddress, UserAgent)
        VALUES (@tenantId, @userId, @action, @targetTable, @targetId, @beforeValues, @afterValues, @ipAddress, @userAgent)
      `);
  } catch (err) {
    // Não deve interromper a operação principal se o log falhar
    logger.error({ err }, "[AuditLog] Erro ao gravar log de auditoria");
  }
}

/**
 * Helper: extrai informações do request para o audit log.
 */
export function extractRequestInfo(req: any): { userId?: string; tenantId?: string; ipAddress?: string; userAgent?: string } {
  const user = req?.user;
  return {
    userId: user?.userId,
    tenantId: user?.tenantId,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers?.["user-agent"]
  };
}
