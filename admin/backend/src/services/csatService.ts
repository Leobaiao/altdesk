import { getPool } from "../db.js";
import { resolveAdapter } from "../adapters/index.js";
import { saveOutboundMessage } from "./conversation.js";
import { emitConversationEvent } from "./socketService.js";

/**
 * Checks if CSAT is enabled for the tenant and sends the survey message.
 */
export async function sendCsatIfEnabled(tenantId: string, conversationId: string, io?: any) {
    const pool = await getPool();

    // 1. Check if CSAT is enabled
    const tenantRes = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT EnableCsat FROM altdesk.Tenant WHERE TenantId = @tenantId");

    if (!tenantRes.recordset[0]?.EnableCsat) return;

    // 2. Fetch conversation external info
    const convRes = await pool.request()
        .input("conversationId", conversationId)
        .query(`
            SELECT TOP 1 etm.ExternalUserId, cc.ConnectorId, cc.Provider, cc.ConfigJson, cc.ChannelId
            FROM altdesk.ExternalThreadMap etm
            JOIN altdesk.ChannelConnector cc ON cc.ConnectorId = etm.ConnectorId
            WHERE etm.ConversationId = @conversationId
        `);

    const data = convRes.recordset[0];
    if (!data) return;

    const { ExternalUserId, ConnectorId, Provider, ConfigJson, ChannelId } = data;
    const csatMessage = "Como foi seu atendimento? Responda de 1 a 5, sendo 1 péssimo e 5 excelente.";

    try {
        // 3. Send message via adapter
        const adapter = resolveAdapter(Provider.toLowerCase());
        const connector = { ConnectorId, Provider, ConfigJson, ChannelId };
        await adapter.sendText(connector, ExternalUserId, csatMessage);

        // 4. Save outbound message
        await saveOutboundMessage(tenantId, conversationId, csatMessage);

        // 5. Emit socket event
        if (io) {
            emitConversationEvent(io, tenantId, conversationId, "message:new", {
                conversationId,
                text: csatMessage,
                direction: "OUT",
                senderName: "Sistema (CSAT)"
            });
        }
    } catch (error) {
        console.error(`[CSAT] Failed to send survey for conversation ${conversationId}:`, error);
    }
}
