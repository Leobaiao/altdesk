import { getPool } from "../db.js";
import { AuthUser } from "../types/index.js";

/**
 * Interface para representar o usuário autenticado no contexto do serviço
 * @deprecated Use AuthUser de ../types/index.js
 */
export type UserContext = AuthUser;

/**
 * Helper para validar se o usuário tem acesso à conversa
 */
export async function checkConversationAccess(user: UserContext, conversationId: string): Promise<{ allowed: boolean, tenantId: string | null }> {
    const pool = await getPool();
    const r = await pool.request()
        .input("conversationId", conversationId)
        .query("SELECT TenantId, AssignedUserId FROM altdesk.Conversation WHERE ConversationId = @conversationId");

    if (r.recordset.length === 0) return { allowed: false, tenantId: null };

    const conv = r.recordset[0];
    const ownerId = conv.AssignedUserId;
    const convTenantId = conv.TenantId;

    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        // SUPERADMIN sees everything, ADMIN only if same tenant
        if (user.role === 'SUPERADMIN' || convTenantId === user.tenantId) {
            return { allowed: true, tenantId: convTenantId };
        }
    }

    if (convTenantId !== user.tenantId) return { allowed: false, tenantId: null };

    // AGENT access check
    if (ownerId === user.userId) return { allowed: true, tenantId: convTenantId };

    if (ownerId === null) {
        // Se não tiver dono, checa se o usuário tem acesso à instância (se houver restrição)
        const access = await pool.request()
            .input("cid", conversationId)
            .input("uid", user.userId)
            .query(`
                SELECT TOP 1 cc.ConnectorId
                FROM altdesk.ExternalThreadMap etm
                JOIN altdesk.ChannelConnector cc ON cc.ConnectorId = etm.ConnectorId
                WHERE etm.ConversationId = @cid 
                  AND (
                    NOT EXISTS (SELECT 1 FROM altdesk.InstanceAssignment ia WHERE ia.ConnectorId = cc.ConnectorId)
                    OR EXISTS (SELECT 1 FROM altdesk.InstanceAssignment ia WHERE ia.ConnectorId = cc.ConnectorId AND ia.UserId = @uid)
                  )
            `);
        return { allowed: access.recordset.length > 0, tenantId: convTenantId };
    }

    return { allowed: false, tenantId: convTenantId };
}

/**
 * Lista conversas com base nas permissões do usuário (com paginação)
 */
export async function listConversations(user: UserContext, limit: number = 50, offset: number = 0) {
    const pool = await getPool();

    // Se for AGENTE, vê apenas as dele OU unassigned (em fila)
    let filterClause = "WHERE c.TenantId = @tenantId AND c.DeletedAt IS NULL";
    let messageFilter = "WHERE Direction = 'OUT' AND TenantId = @tenantId";

    if (user.role === 'AGENT') {
        filterClause += ` AND (
            c.AssignedUserId = @userId 
            OR (
                c.AssignedUserId IS NULL 
                AND (
                    etm.ConnectorId IS NULL
                    OR NOT EXISTS (SELECT 1 FROM altdesk.InstanceAssignment ia WHERE ia.ConnectorId = etm.ConnectorId)
                    OR EXISTS (SELECT 1 FROM altdesk.InstanceAssignment ia WHERE ia.ConnectorId = etm.ConnectorId AND ia.UserId = @userId)
                )
            )
        )`;
    } else if (user.role === 'SUPERADMIN') {
        // SUPERADMIN vê todas as conversas de todos os tenants
        filterClause = "WHERE c.DeletedAt IS NULL";
        messageFilter = "WHERE Direction = 'OUT'";
    }

    const r = await pool.request()
        .input("tenantId", user.tenantId)
        .input("userId", user.userId)
        .input("limit", limit)
        .input("offset", offset)
        .query(`
      WITH LastOutbound AS (
        SELECT ConversationId, MAX(CreatedAt) as LastOutAt
        FROM altdesk.Message
        ${messageFilter}
        GROUP BY ConversationId
      )
      SELECT c.ConversationId, c.Title, c.Status, c.Kind, c.LastMessageAt, c.QueueId, c.AssignedUserId,
             c.SourceChannel, c.InteractionSequence, c.CreatedAt,
             etm.ExternalUserId,
             q.Name AS QueueName,
             assignedUser.DisplayName AS AssignedUserName,
             assignedUser.Email AS AssignedUserEmail,
             ct.Name AS ContactName,
             ct.CPF AS ContactCPF,
              ct.Phone AS ContactPhone,
              (
                SELECT t.TagId, t.Name, t.Color
                FROM altdesk.Tag t
                JOIN altdesk.ConversationTag ctag ON ctag.TagId = t.TagId
                WHERE ctag.ConversationId = c.ConversationId
                FOR JSON PATH
              ) AS TagsJson,
              (
                SELECT COUNT(*) 
                FROM altdesk.Message m
                WHERE m.ConversationId = c.ConversationId
                  AND m.Direction = 'IN'
                  AND m.CreatedAt > ISNULL(lo.LastOutAt, '1900-01-01')
              ) AS UnreadCount
      FROM altdesk.Conversation c
      LEFT JOIN altdesk.ExternalThreadMap etm ON etm.ConversationId = c.ConversationId
      LEFT JOIN altdesk.Queue q ON q.QueueId = c.QueueId
      LEFT JOIN altdesk.[User] assignedUser ON assignedUser.UserId = c.AssignedUserId
      LEFT JOIN altdesk.Contact ct ON ct.Phone = REPLACE(REPLACE(etm.ExternalUserId, '@s.whatsapp.net', ''), '@c.us', '') AND ct.TenantId = c.TenantId
      LEFT JOIN LastOutbound lo ON lo.ConversationId = c.ConversationId
      ${filterClause}
      ORDER BY COALESCE(c.LastMessageAt, c.CreatedAt) DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
    return r.recordset.map(row => ({
        ...row,
        Tags: row.TagsJson ? JSON.parse(row.TagsJson) : []
    }));
}

/**
 * Busca as mensagens de uma conversa (com paginação)
 */
export async function getConversationMessages(conversationId: string, tenantId: string | null, limit: number = 50, offset: number = 0) {
    const pool = await getPool();
    const r = await pool.request()
        .input("conversationId", conversationId)
        .input("tenantId", tenantId)
        .input("limit", limit)
        .input("offset", offset)
        .query(`
      SELECT MessageId, ExternalMessageId, Body, Direction, SenderExternalId, MediaType, MediaUrl, Status, CreatedAt
      FROM altdesk.Message
      WHERE ConversationId = @conversationId AND TenantId = @tenantId AND DeletedAt IS NULL
      ORDER BY CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
    return r.recordset.reverse(); // Voltamos para ordem ascendente para o cliente
}

/**
 * Busca metadados para resposta (connector e ExternalUserId)
 */
export async function getReplyMetadata(conversationId: string, tenantId: string | null) {
    const pool = await getPool();
    const r = await pool.request()
        .input("conversationId", conversationId)
        .input("tenantId", tenantId)
        .query(`
      SELECT
        etm.ExternalUserId,
        etm.ConnectorId,
        cc.Provider,
        cc.ConfigJson
      FROM altdesk.ExternalThreadMap etm
      JOIN altdesk.ChannelConnector cc ON cc.ConnectorId = etm.ConnectorId
      WHERE etm.ConversationId = @conversationId
        AND etm.TenantId = @tenantId
    `);

    if (r.recordset.length === 0) return null;

    const data = r.recordset[0];
    return {
        externalUserId: data.ExternalUserId,
        connector: {
            ConnectorId: data.ConnectorId,
            Provider: data.Provider,
            ConfigJson: data.ConfigJson
        },
        provider: String(data.Provider).toLowerCase()
    };
}

/**
 * Atualiza o status da conversa
 */
export async function updateConversationStatus(conversationId: string, tenantId: string | null, status: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .input("status", status)
        .query(`
            UPDATE altdesk.Conversation 
            SET Status = @status,
                ClosedAt = CASE WHEN @status = 'RESOLVED' THEN SYSUTCDATETIME() ELSE NULL END
            WHERE TenantId = @tenantId AND ConversationId = @conversationId
        `);
}

/**
 * Reapontar conector (fallback para provedor padrão)
 */
export async function reassignConnectorToDefault(conversationId: string, tenantId: string | null) {
    const pool = await getPool();

    const t = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT DefaultProvider FROM altdesk.Tenant WHERE TenantId=@tenantId");
    const defaultProvider = t.recordset[0]?.DefaultProvider || "GTI";

    const c = await pool.request()
        .input("tenantId", tenantId)
        .input("provider", defaultProvider)
        .query(`
      SELECT TOP 1 cc.ConnectorId
      FROM altdesk.ChannelConnector cc
      JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
      WHERE ch.TenantId=@tenantId AND cc.Provider=@provider AND cc.IsActive=1
    `);

    if (c.recordset.length === 0) throw new Error("Nenhum conector ativo para o provider padrão");
    const newConnectorId = c.recordset[0].ConnectorId;

    await pool.request()
        .input("conversationId", conversationId)
        .input("tenantId", tenantId)
        .input("newConnectorId", newConnectorId)
        .query(`
      UPDATE altdesk.ExternalThreadMap
      SET ConnectorId = @newConnectorId
      WHERE ConversationId = @conversationId AND TenantId = @tenantId
    `);

    return defaultProvider;
}
