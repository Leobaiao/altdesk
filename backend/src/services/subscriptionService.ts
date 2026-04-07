import { getPool } from "../db.js";
import { logger } from "../lib/logger.js";

/**
 * Ativa a assinatura oficial do tenant e realiza a limpeza de dados demo.
 */
export async function activateOfficialSubscription(tenantId: string) {
    const pool = await getPool();
    
    logger.info({ tenantId }, "[Subscription] Activating official account and purging demo data");

    try {
        // 1. Atualizar Status e IsDemo no Tenant
        await pool.request()
            .input("tenantId", tenantId)
            .query(`
                UPDATE altdesk.Tenant
                SET AccountStatus = 'ACTIVE',
                    IsDemo = 0,
                    UpdatedAt = SYSUTCDATETIME()
                WHERE TenantId = @tenantId
            `);

        // 2. Executar a Stored Procedure de Limpeza (Purge)
        // Mantemos estrutura (Logo, Horarios, Usuarios) mas deletamos transacoes demo
        await pool.request()
            .input("tenantId", tenantId)
            .execute("altdesk.sp_altdesk_purge_demo_data");

        logger.info({ tenantId }, "[Subscription] Account activated and demo data purged successfully");
        return { ok: true };
    } catch (err: any) {
        logger.error({ tenantId, error: err.message }, "[Subscription] Failed to activate official account");
        throw err;
    }
}
