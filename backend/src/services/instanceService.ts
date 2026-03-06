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
    return (await pool.request()
        .input("tid", tenantId)
        .query(`
      SELECT 
        cc.ConnectorId, cc.Provider, cc.ConfigJson, cc.IsActive, cc.DeletedAt,
        ch.Name as ChannelName, ch.ChannelId
      FROM altdesk.ChannelConnector cc
      JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
      WHERE ch.TenantId = @tid AND cc.DeletedAt IS NULL
      ORDER BY ch.Name
    `)).recordset;
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

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const request = transaction.request();
        connectorIds.forEach((id: string, index: number) => {
            request.input(`id${index}`, id);
        });
        const idParams = connectorIds.map((_: string, index: number) => `@id${index}`).join(",");

        await request.query(`
        UPDATE altdesk.ChannelConnector 
        SET IsActive = 0, DeletedAt = SYSUTCDATETIME()
        WHERE ConnectorId IN (${idParams})
    `);

        await transaction.commit();
        return connectorIds.length;
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}
