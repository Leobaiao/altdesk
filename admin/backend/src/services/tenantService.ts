import sql from "mssql";
import { getPool } from "../db.js";
import { hashPassword } from "../auth.js";

/**
 * Lista todos os tenants com contadores de usuários e instâncias
 */
export async function listTenants() {
    const pool = await getPool();
    const r = await pool.request().query(`
    SELECT t.TenantId, t.Name, t.CreatedAt, 
           s.IsActive, s.ExpiresAt, s.AgentsSeatLimit,
           bs.Status as BillingStatus,
           bs.NextDueDate as BillingNextDue,
           bp.Name as PlanName,
           (SELECT COUNT(*) FROM altdesk.[User] u WHERE u.TenantId = t.TenantId AND u.IsActive=1) as UserCount,
           (
             SELECT COUNT(*) FROM altdesk.ChannelConnector cc 
             JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId 
             WHERE ch.TenantId = t.TenantId AND cc.IsActive=1 AND cc.DeletedAt IS NULL
           ) as InstanceCount
    FROM altdesk.Tenant t
    LEFT JOIN altdesk.Subscription s ON s.TenantId = t.TenantId
    LEFT JOIN altdesk.BillingSubscription bs ON bs.TenantId = t.TenantId AND bs.Provider = 'asaas' AND bs.Status <> 'canceled'
    LEFT JOIN altdesk.BillingPlan bp ON bp.PlanId = bs.PlanId
    WHERE t.DeletedAt IS NULL
    ORDER BY t.CreatedAt DESC
  `);
    return r.recordset;
}

/**
 * Cria um novo Tenant com Admin e agente humano inicial (Transacional)
 */
export async function createTenantWithAdmin(data: {
    companyName: string,
    adminName: string,
    email: string,
    passwordRaw: string,
    planDays: number,
    agentsLimit: number
}) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const rTenant = await transaction.request()
            .input("name", data.companyName)
            .query("INSERT INTO altdesk.Tenant (Name) OUTPUT inserted.TenantId VALUES (@name)");
        const tenantId = rTenant.recordset[0].TenantId;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + data.planDays);

        await transaction.request()
            .input("tenantId", tenantId)
            .input("limit", data.agentsLimit)
            .input("expires", expiresAt)
            .query(`
      INSERT INTO altdesk.Subscription (TenantId, AgentsSeatLimit, ExpiresAt, IsActive)
      VALUES (@tenantId, @limit, @expires, 1)
    `);

        const hash = await hashPassword(data.passwordRaw);
        const rUser = await transaction.request()
            .input("tenantId", tenantId)
            .input("email", data.email)
            .input("name", data.adminName)
            .input("hash", hash)
            .query(`
      INSERT INTO altdesk.[User] (TenantId, Email, DisplayName, PasswordHash, Role)
      OUTPUT inserted.UserId
      VALUES (@tenantId, @email, @name, @hash, 'ADMIN')
    `);
        const userId = rUser.recordset[0].UserId;

        await transaction.request()
            .input("tenantId", tenantId)
            .input("userId", userId)
            .input("name", data.adminName)
            .query(`
      INSERT INTO altdesk.Agent (TenantId, UserId, Kind, Name)
      VALUES (@tenantId, @userId, 'HUMAN', @name)
    `);

        await transaction.commit();
        return { tenantId, userId };
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

/**
 * Atualiza limites de assinatura do Tenant
 */
export async function updateTenantSubscription(tenantId: string, agentsLimit?: number) {
    if (agentsLimit === undefined) return;
    const pool = await getPool();
    await pool.request()
        .input("tid", tenantId)
        .input("limit", agentsLimit)
        .query("UPDATE altdesk.Subscription SET AgentsSeatLimit = @limit WHERE TenantId = @tid");
}

/**
 * Alterna o status (Ativo/Inativo) do Tenant e recursos relacionados
 */
export async function setTenantStatus(tenantId: string, active: boolean) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const activeBit = active ? 1 : 0;

    try {
        await transaction.request()
            .input("tenantId", tenantId)
            .input("active", activeBit)
            .query("UPDATE altdesk.Subscription SET IsActive=@active WHERE TenantId=@tenantId");

        await transaction.request()
            .input("tenantId", tenantId)
            .input("active", activeBit)
            .query("UPDATE altdesk.[User] SET IsActive=@active WHERE TenantId=@tenantId");

        // Para conectores, se estiver desativando, desativa tudo. 
        // Se estiver reativando, só os que não foram deletados.
        const connectorQuery = active
            ? `UPDATE cc SET IsActive=1
         FROM altdesk.ChannelConnector cc
         JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
         WHERE ch.TenantId = @tenantId AND cc.DeletedAt IS NULL`
            : `UPDATE cc SET IsActive=0
         FROM altdesk.ChannelConnector cc
         JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
         WHERE ch.TenantId = @tenantId`;

        await transaction.request()
            .input("tenantId", tenantId)
            .query(connectorQuery);

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

/**
 * Lista empresas na lixeira
 */
export async function listDeletedTenants() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT t.TenantId, t.Name, t.DeletedAt, 
               s.AgentsSeatLimit,
               (SELECT COUNT(*) FROM altdesk.[User] u WHERE u.TenantId = t.TenantId) as UserCount
        FROM altdesk.Tenant t
        LEFT JOIN altdesk.Subscription s ON s.TenantId = t.TenantId
        WHERE t.DeletedAt IS NOT NULL
        ORDER BY t.DeletedAt DESC
    `);
    return r.recordset;
}

/**
 * Restaura uma empresa da lixeira
 */
export async function restoreTenant(tenantId: string) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        await transaction.request()
            .input("tenantId", tenantId)
            .query("UPDATE altdesk.Tenant SET DeletedAt = NULL WHERE TenantId = @tenantId");

        await transaction.request()
            .input("tenantId", tenantId)
            .query("UPDATE altdesk.Subscription SET IsActive = 1 WHERE TenantId = @tenantId");

        await transaction.request()
            .input("tenantId", tenantId)
            .query("UPDATE altdesk.[User] SET IsActive = 1 WHERE TenantId = @tenantId AND DeletedAt IS NULL");

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

