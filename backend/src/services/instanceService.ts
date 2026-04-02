import sql from "mssql";
import { getPool } from "../db.js";

/**
 * Lista todas as instâncias (conectores) do sistema
 */
export async function listAllInstances() {
    const pool = await getPool();
    return (await pool.request().query(`
    SELECT 
      cc.ConnectorId, cc.Provider, cc.ConfigJson, cc.WebhookSecret, cc.IsActive, cc.DeletedAt,
      ch.Name as ChannelName, ch.ChannelId,
      t.Name as TenantName, t.TenantId
    FROM altdesk.ChannelConnector cc
    JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
    JOIN altdesk.Tenant t ON t.TenantId = ch.TenantId
    WHERE cc.DeletedAt IS NULL
    ORDER BY t.Name, ch.Name
  `)).recordset;
}

/**
 * Lista instâncias de um tenant específico
 */
export async function listTenantInstances(tenantId: string) {
    const pool = await getPool();
    const instances = (await pool.request()
        .input("tid", tenantId)
        .query(`
      SELECT 
        cc.ConnectorId, cc.Provider, cc.ConfigJson, cc.IsActive, cc.DeletedAt,
        ch.Name as ChannelName, ch.ChannelId,
        (
          SELECT u.UserId, u.Name, u.DisplayName
          FROM altdesk.InstanceAssignment ia
          JOIN altdesk.[User] u ON u.UserId = ia.UserId
          WHERE ia.ConnectorId = cc.ConnectorId
          FOR JSON PATH
        ) AS AssignedUsersJson
      FROM altdesk.ChannelConnector cc
      JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
      WHERE ch.TenantId = @tid AND cc.DeletedAt IS NULL
      ORDER BY ch.Name
    `)).recordset;

    return instances.map((inst: any) => ({
        ...inst,
        assignedUsers: inst.AssignedUsersJson ? JSON.parse(inst.AssignedUsersJson) : [],
        AssignedUsersJson: undefined
    }));
}

/**
 * Cria uma nova instância (Channel + Connector)
 */
export async function createInstance(data: {
    tenantId: string,
    provider: string,
    name: string,
    config: any
}) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const rCh = await transaction.request()
            .input("tenantId", data.tenantId)
            .input("name", data.name)
            .input("type", data.provider === "GTI" ? "WHATSAPP" : data.provider)
            .query(`
      INSERT INTO altdesk.Channel (TenantId, Name, Type, IsActive)
      OUTPUT inserted.ChannelId
      VALUES (@tenantId, @name, @type, 1)
    `);
        const channelId = rCh.recordset[0].ChannelId;

        const configStr = typeof data.config === "string" ? data.config : JSON.stringify(data.config);

        const rConn = await transaction.request()
            .input("channelId", channelId)
            .input("provider", data.provider.toUpperCase())
            .input("config", configStr)
            .query(`
      INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson, IsActive)
      OUTPUT inserted.ConnectorId, inserted.WebhookSecret
      VALUES (NEWID(), @channelId, @provider, @config, 1)
    `);

        await transaction.commit();
        return { connectorId: rConn.recordset[0].ConnectorId };
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

/**
 * Reatribui uma instância a um novo tenant
 */
export async function updateInstanceTenant(connectorId: string, tenantId: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("connectorId", connectorId)
        .query(`
        UPDATE ch 
        SET TenantId = @tenantId
        FROM altdesk.Channel ch
        JOIN altdesk.ChannelConnector cc ON cc.ChannelId = ch.ChannelId
        WHERE cc.ConnectorId = @connectorId
      `);
}

/**
 * Deleção em lote (soft-delete)
 */
export async function bulkDeleteInstances(connectorIds: string[]) {
    if (!connectorIds.length) return 0;

    // Critical: Validate that all IDs are valid UUIDs to prevent any SQLi attempt
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = connectorIds.filter(id => uuidRegex.test(id));
    if (validIds.length === 0) return 0;

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const request = transaction.request();
        validIds.forEach((id, index) => {
            request.input(`id${index}`, id);
        });
        const idParams = validIds.map((_, index) => `@id${index}`).join(",");

        // Safe: using parameterized IN clause
        await transaction.request()
            .input("ids", validIds.join(",")) // Alternative if DB supports it, but @idN is safer for mssql
            .query(`DELETE FROM altdesk.InstanceAssignment WHERE ConnectorId IN (${idParams})`);

        const bulkRequest = transaction.request();
        validIds.forEach((id, index) => {
            bulkRequest.input(`id${index}`, id);
        });
        await bulkRequest.query(`
        UPDATE altdesk.ChannelConnector 
        SET IsActive = 0, DeletedAt = SYSUTCDATETIME()
        WHERE ConnectorId IN (${idParams})
    `);

        await transaction.commit();
        return validIds.length;
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

/**
 * Atribui múltiplos funcionários a uma instância (substitui os atuais)
 */
export async function assignUsersToInstance(connectorId: string, userIds: string[], tenantId: string) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        // 1. Validar que todos os userIds e connectorId são UUIDs válidos
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(connectorId)) throw new Error("Invalid ConnectorId");
        
        const validUserIds = userIds.filter(id => uuidRegex.test(id));

        if (validUserIds.length > 0) {
            const request = transaction.request();
            validUserIds.forEach((uid, index) => request.input(`uid${index}`, uid));
            const uidParams = validUserIds.map((_, index) => `@uid${index}`).join(",");

            const validCount = await request
                .input("tenantId", tenantId)
                .query(`SELECT COUNT(*) as count FROM altdesk.[User] WHERE TenantId = @tenantId AND UserId IN (${uidParams})`);
            
            if (validCount.recordset[0].count !== validUserIds.length) {
                throw new Error("Alguns IDs de usuário são inválidos ou pertencem a outro tenant.");
            }
        }

        // 2. Remove atribuições atuais
        await transaction.request()
            .input("cid", connectorId)
            .query(`DELETE FROM altdesk.InstanceAssignment WHERE ConnectorId = @cid`);

        // 3. Insere novas
        for (const uid of userIds) {
            await transaction.request()
                .input("cid", connectorId)
                .input("uid", uid)
                .input("tid", tenantId)
                .query(`INSERT INTO altdesk.InstanceAssignment (TenantId, ConnectorId, UserId) VALUES (@tid, @cid, @uid)`);
        }

        await transaction.commit();
        return userIds.length;
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

/**
 * Lista quais instâncias estão atribuídas a um usuário ou são globais (vazias)
 */
export async function listUserAvailableInstances(userId: string, tenantId: string) {
    const pool = await getPool();
    return (await pool.request()
        .input("uid", userId)
        .input("tid", tenantId)
        .query(`
            SELECT DISTINCT cc.ConnectorId, ch.Name as ChannelName, cc.Provider
            FROM altdesk.ChannelConnector cc
            JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
            LEFT JOIN altdesk.InstanceAssignment ia ON ia.ConnectorId = cc.ConnectorId
            WHERE ch.TenantId = @tid 
              AND cc.IsActive = 1 
              AND cc.DeletedAt IS NULL
              AND (
                ia.UserId = @uid OR 
                NOT EXISTS (SELECT 1 FROM altdesk.InstanceAssignment ia2 WHERE ia2.ConnectorId = cc.ConnectorId)
              )
        `)).recordset;
}
