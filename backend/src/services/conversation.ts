import sql from "mssql";
import { getPool } from "../db.js";
import { NormalizedInbound } from "../adapters/types.js";
import { recordConversationHistory } from "./conversationHistory.js";

/**
 * Resolve ou cria Conversation para um thread externo.
 */
export async function resolveConversationForInbound(inb: NormalizedInbound, connectorId: string, channelId: string) {
  const pool = await getPool();

  // 1. Tenta achar pelo ExternalChatId + ConnectorId (match exato do webhook)
  const found = await pool.request()
    .input("tenantId", inb.tenantId)
    .input("connectorId", connectorId)
    .input("externalChatId", inb.externalChatId)
    .query(`
      SELECT ConversationId
      FROM omni.ExternalThreadMap
      WHERE TenantId=@tenantId AND ConnectorId=@connectorId AND ExternalChatId=@externalChatId
    `);

  if (found.recordset.length > 0) {
    const cid = found.recordset[0].ConversationId;
    // Atualiza título com o nome do WhatsApp se disponível
    if (inb.senderName) {
      await pool.request()
        .input("cid", cid)
        .input("title", inb.senderName)
        .query("UPDATE omni.Conversation SET Title = @title WHERE ConversationId = @cid AND Title LIKE 'WhatsApp%'");
    }
    return cid as string;
  }

  // 2. Fallback: busca pelo ExternalUserId (evita duplicar com conversas criadas manualmente)
  const byUser = await pool.request()
    .input("tenantId", inb.tenantId)
    .input("externalUserId", inb.externalUserId)
    .query(`
      SELECT TOP 1 ConversationId
      FROM omni.ExternalThreadMap
      WHERE TenantId=@tenantId AND ExternalUserId=@externalUserId
    `);

  if (byUser.recordset.length > 0) {
    // Atualiza o mapeamento com o ConnectorId e ExternalChatId corretos
    const existingCid = byUser.recordset[0].ConversationId;
    await pool.request()
      .input("tenantId", inb.tenantId)
      .input("externalUserId", inb.externalUserId)
      .input("connectorId", connectorId)
      .input("externalChatId", inb.externalChatId)
      .query(`
        UPDATE omni.ExternalThreadMap
        SET ConnectorId = @connectorId, ExternalChatId = @externalChatId
        WHERE TenantId = @tenantId AND ExternalUserId = @externalUserId
      `);
    return existingCid as string;
  }

  // 3. Cria conversa nova
  const title = inb.senderName || `WhatsApp • ${inb.externalUserId}`;
  const created = await pool.request()
    .input("tenantId", inb.tenantId)
    .input("channelId", channelId)
    .input("title", title)
    .input("connectorId", connectorId)
    .input("externalChatId", inb.externalChatId)
    .input("externalUserId", inb.externalUserId)
    .query(`
      DECLARE @cid UNIQUEIDENTIFIER = NEWID();
      INSERT INTO omni.Conversation (ConversationId, TenantId, ChannelId, Title, Kind, Status)
      VALUES (@cid, @tenantId, @channelId, @title, 'DIRECT', 'OPEN');

      INSERT INTO omni.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
      VALUES (@tenantId, @connectorId, @externalChatId, @externalUserId, @cid);

      SELECT @cid AS ConversationId;
    `);

  const cid = created.recordset[0].ConversationId as string;

  // Registrar abertura no histórico
  await recordConversationHistory({
    tenantId: inb.tenantId,
    conversationId: cid,
    action: "OPENED",
    metadata: { source: inb.channel || "WHATSAPP", externalUserId: inb.externalUserId }
  });

  return cid;
}

export async function saveInboundMessage(inb: NormalizedInbound, conversationId: string) {
  const pool = await getPool();
  await pool.request()
    .input("tenantId", inb.tenantId)
    .input("conversationId", conversationId)
    .input("senderExternalId", inb.externalUserId)
    .input("direction", "IN")
    .input("body", inb.text ?? (inb.mediaType ? `[${inb.mediaType}]` : ""))
    .input("mediaType", inb.mediaType ?? null)
    .input("mediaUrl", inb.mediaUrl ?? null)
    .input("externalMessageId", inb.externalMessageId ?? null)
    .input("payload", JSON.stringify(inb.raw))
    .query(`
      INSERT INTO omni.Message (TenantId, ConversationId, SenderExternalId, Direction, Body, MediaType, MediaUrl, ExternalMessageId, PayloadJson)
      VALUES (@tenantId, @conversationId, @senderExternalId, @direction, @body, @mediaType, @mediaUrl, @externalMessageId, @payload);

      UPDATE omni.Conversation SET LastMessageAt = SYSUTCDATETIME()
      WHERE ConversationId=@conversationId;
    `);

  // Registrar interação no histórico
  await recordConversationHistory({
    tenantId: inb.tenantId,
    conversationId,
    action: "REPLIED",
    metadata: { direction: "IN", mediaType: inb.mediaType || "text" }
  });
}

/**
 * Atualiza o status de uma mensagem (DELIVERED, READ) pelo ExternalMessageId.
 * Retorna o ConversationId se encontrou a mensagem, null caso contrário.
 */
export async function updateMessageStatus(tenantId: string, externalMessageId: string, status: string): Promise<string | null> {
  const pool = await getPool();
  const r = await pool.request()
    .input("tenantId", tenantId)
    .input("externalMsgId", externalMessageId)
    .input("status", status)
    .query(`
      UPDATE omni.Message 
      SET Status = @status 
      WHERE TenantId = @tenantId AND ExternalMessageId = @externalMsgId
        AND (
          (@status = 'DELIVERED' AND Status = 'SENT')
          OR (@status = 'READ' AND Status IN ('SENT', 'DELIVERED'))
        );

      SELECT TOP 1 ConversationId FROM omni.Message 
      WHERE TenantId = @tenantId AND ExternalMessageId = @externalMsgId;
    `);

  return r.recordset.length > 0 ? r.recordset[0].ConversationId : null;
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

  // Registrar interação no histórico
  await recordConversationHistory({
    tenantId,
    conversationId,
    action: "REPLIED",
    metadata: { direction: "OUT" }
  });
}

/**
 * Busca conversa existente por telefone ou cria nova usando o primeiro conector WhatsApp ativo.
 */
export async function findOrCreateConversation(tenantId: string, phone: string, name?: string, assignedUserId?: string) {
  const pool = await getPool();

  // 1. Tentar achar via ExternalThreadMap
  let externalUserId = phone;
  // TODO: Move suffix logic to adapters or config
  if (!externalUserId.includes("@") && !externalUserId.startsWith("webchat_")) {
    externalUserId += "@s.whatsapp.net";
  }

  const found = await pool.request()
    .input("tenantId", tenantId)
    .input("externalUserId", externalUserId)
    .query(`
      SELECT TOP 1 ConversationId
      FROM omni.ExternalThreadMap
      WHERE TenantId=@tenantId AND ExternalUserId=@externalUserId
    `);

  if (found.recordset.length > 0) {
    const cid = found.recordset[0].ConversationId;

    // Se a conversa ja existir mas não tiver dono, e tivermos um assignedUserId, vamos atribuir agora
    if (assignedUserId) {
      await pool.request()
        .input("cid", cid)
        .input("userId", assignedUserId)
        .input("tenantId", tenantId)
        .query(`
          UPDATE omni.Conversation 
          SET AssignedUserId = @userId 
          WHERE ConversationId = @cid AND TenantId = @tenantId AND AssignedUserId IS NULL
        `);
    }

    return cid as string;
  }

  // 2. Se não achou, precisamos de um conector para criar o vínculo
  const tenant = await pool.request()
    .input("tenantId", tenantId)
    .query("SELECT DefaultProvider FROM omni.Tenant WHERE TenantId=@tenantId");
  const defaultProvider = (tenant.recordset[0]?.DefaultProvider || 'GTI').toUpperCase();

  const conn = await pool.request()
    .input("tenantId", tenantId)
    .input("provider", defaultProvider)
    .query(`
      SELECT TOP 1 cc.ConnectorId, ch.ChannelId
      FROM omni.ChannelConnector cc
      JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
      WHERE ch.TenantId = @tenantId AND cc.IsActive = 1
      ORDER BY CASE WHEN cc.Provider = @provider THEN 0 ELSE 1 END, cc.ConnectorId
    `);

  if (conn.recordset.length === 0) {
    throw new Error(`Nenhum canal ativo para criar conversa (Provider preferido: ${defaultProvider}).`);
  }
  const connectorId = conn.recordset[0].ConnectorId;
  const channelId = conn.recordset[0].ChannelId;

  const title = name || `WhatsApp • ${phone}`;

  // 3. Criar conversa
  const created = await pool.request()
    .input("tenantId", tenantId)
    .input("channelId", channelId)
    .input("title", title)
    .input("connectorId", connectorId)
    .input("externalUserId", externalUserId)
    .input("userId", assignedUserId || null)
    .query(`
      DECLARE @cid UNIQUEIDENTIFIER = NEWID();
      INSERT INTO omni.Conversation (ConversationId, TenantId, ChannelId, Title, Kind, Status, AssignedUserId)
      VALUES (@cid, @tenantId, @channelId, @title, 'DIRECT', 'OPEN', @userId);

      INSERT INTO omni.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
      VALUES (@tenantId, @connectorId, @externalUserId, @externalUserId, @cid);

      SELECT @cid AS ConversationId;
    `);

  return created.recordset[0].ConversationId as string;
}

export async function deleteConversation(tenantId: string, conversationId: string) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await transaction.request()
      .input("tenantId", tenantId)
      .input("conversationId", conversationId)
      .query(`
        DELETE FROM omni.Message WHERE ConversationId = @conversationId AND TenantId = @tenantId;
        DELETE FROM omni.ExternalThreadMap WHERE ConversationId = @conversationId AND TenantId = @tenantId;
        DELETE FROM omni.Conversation WHERE ConversationId = @conversationId AND TenantId = @tenantId;
      `);
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
