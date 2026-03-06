import { getPool } from "./db.js";

// Helper: load connector + channel + tenant
export async function loadConnector(connectorId: string) {
    const pool = await getPool();
    const r = await pool.request()
        .input("connectorId", connectorId)
        .query(`
      SELECT cc.ConnectorId, cc.Provider, cc.ConfigJson, cc.WebhookSecret, ch.ChannelId, ch.TenantId
      FROM omni.ChannelConnector cc
      JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
      WHERE cc.ConnectorId = @connectorId AND cc.IsActive=1 AND ch.IsActive=1
    `);
    if (r.recordset.length === 0) throw new Error("Connector not found/active");
    return r.recordset[0];
}
