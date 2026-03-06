import { getPool } from "../db.js";
import { NormalizedInbound } from "../adapters/types.js";

/**
 * Resolve ou cria Conversation para um thread externo.
 */
export async function resolveConversationForInbound(inb: NormalizedInbound, connectorId: string, channelId: string) {
  const pool = await getPool();

  // tenta achar map
  const found = await pool.request()
    .input("tenantId", inb.tenantId)
    .input("connectorId", connectorId)
    .input("externalChatId", inb.externalChatId)
    .query(`
      SELECT ConversationId
      FROM omni.ExternalThreadMap
      WHERE TenantId=@tenantId AND ConnectorId=@connectorId AND ExternalChatId=@externalChatId
    `);

  if (found.recordset.length > 0) return found.recordset[0].ConversationId as string;

  // cria conversa
  const title = `WhatsApp • ${inb.externalUserId}`;
  const created = await pool.request()
    .input("tenantId", inb.tenantId)
    .input("channelId", channelId)
    .input("title", title)
    .query(`
      DECLARE @cid UNIQUEIDENTIFIER = NEWID();
      INSERT INTO omni.Conversation (ConversationId, TenantId, ChannelId, Title, Kind, Status)
      VALUES (@cid, @tenantId, @channelId, @title, 'DIRECT', 'OPEN');

      INSERT INTO omni.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
      VALUES (@tenantId, @connectorId, @externalChatId, @externalUserId, @cid);

      SELECT @cid AS ConversationId;
    `);

  return created.recordset[0].ConversationId as string;
}

export async function saveInboundMessage(inb: NormalizedInbound, conversationId: string) {
  const pool = await getPool();
  await pool.request()
    .input("tenantId", inb.tenantId)
    .input("conversationId", conversationId)
    .input("senderExternalId", inb.externalUserId)
    .input("direction", "IN")
    .input("body", inb.text ?? "[media]")
    .input("payload", JSON.stringify(inb.raw))
    .query(`
      INSERT INTO omni.Message (TenantId, ConversationId, SenderExternalId, Direction, Body, PayloadJson)
      VALUES (@tenantId, @conversationId, @senderExternalId, @direction, @body, @payload);

      UPDATE omni.Conversation SET LastMessageAt = SYSUTCDATETIME()
      WHERE ConversationId=@conversationId;
    `);
}

export async function saveOutboundMessage(tenantId: string, conversationId: string, body: string) {
  const pool = await getPool();
  await pool.request()
    .input("tenantId", tenantId)
    .input("conversationId", conversationId)
    .input("direction", "OUT")
    .input("body", body)
    .query(`
      INSERT INTO omni.Message (TenantId, ConversationId, Direction, Body)
      VALUES (@tenantId, @conversationId, @direction, @body);

      UPDATE omni.Conversation SET LastMessageAt = SYSUTCDATETIME()
      WHERE ConversationId=@conversationId;
    `);
}
