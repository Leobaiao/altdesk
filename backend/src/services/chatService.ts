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
        .query("SELECT TenantId, AssignedUserId, RequesterUserId FROM altdesk.Conversation WHERE ConversationId = @conversationId AND DeletedAt IS NULL");

    if (r.recordset.length === 0) return { allowed: false, tenantId: null };

    const conv = r.recordset[0];
    const ownerId = conv.AssignedUserId;
    const requesterId = conv.RequesterUserId;
    const convTenantId = conv.TenantId;

    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        // SUPERADMIN sees everything, ADMIN only if same tenant
        if (user.role === 'SUPERADMIN' || convTenantId === user.tenantId) {
            return { allowed: true, tenantId: convTenantId };
        }
    }

    if (convTenantId !== user.tenantId) return { allowed: false, tenantId: null };

    // Verifica se o usuário é participante direto da conversa (Iniciador ou Destinatário)
    const isDirectParticipant = (requesterId === user.userId || ownerId === user.userId);

    // END_USER access check: only their own requested conversations or assigned to them
    if (user.role === 'END_USER') {
        return { allowed: isDirectParticipant, tenantId: convTenantId };
    }

    // AGENT access check: if direct participant, allowed.
    if (isDirectParticipant) return { allowed: true, tenantId: convTenantId };

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
 * Busca detalhes de uma única conversa
 */
export async function getConversationDetails(user: UserContext, conversationId: string) {
    const pool = await getPool();

    let messageFilter = "WHERE Direction = 'OUT' AND TenantId = @tenantId AND DeletedAt IS NULL";
    if (user.role === 'SUPERADMIN') {
        messageFilter = "WHERE Direction = 'OUT' AND DeletedAt IS NULL";
    }

    const r = await pool.request()
        .input("tenantId", user.tenantId)
        .input("conversationId", conversationId)
        .query(`
      WITH LastOutbound AS (
        SELECT ConversationId, MAX(CreatedAt) as LastOutAt
        FROM altdesk.Message
        ${messageFilter}
        GROUP BY ConversationId
      )
      SELECT c.ConversationId, c.Title, c.Status, c.Kind, c.LastMessageAt, c.QueueId, c.AssignedUserId,
             c.RequesterUserId,
             ch.Type AS SourceChannel, c.InteractionSequence, c.CreatedAt, c.ClosedAt,
             etm.ExternalUserId,
             q.Name AS QueueName,
             assignedUser.DisplayName AS AssignedUserName,
             ISNULL(ct.Name, requesterUser.DisplayName) AS ContactName,
              t.Priority, t.SlaStatus, t.SLAFirstResponseDue, t.SLAResolutionDue, t.EscalationLevel, t.ResolutionDescription,
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
                  AND m.DeletedAt IS NULL
              ) AS UnreadCount
      FROM altdesk.Conversation c
      LEFT JOIN altdesk.Channel ch ON ch.ChannelId = c.ChannelId
      LEFT JOIN altdesk.ExternalThreadMap etm ON etm.ConversationId = c.ConversationId
      LEFT JOIN altdesk.Queue q ON q.QueueId = c.QueueId
      LEFT JOIN altdesk.[User] assignedUser ON assignedUser.UserId = c.AssignedUserId
      LEFT JOIN altdesk.[User] requesterUser ON requesterUser.UserId = c.RequesterUserId
      LEFT JOIN altdesk.Contact ct ON ct.Phone = REPLACE(REPLACE(etm.ExternalUserId, '@s.whatsapp.net', ''), '@c.us', '') AND ct.TenantId = c.TenantId
      LEFT JOIN LastOutbound lo ON lo.ConversationId = c.ConversationId
      LEFT JOIN altdesk.Ticket t ON t.ConversationId = c.ConversationId AND t.TenantId = c.TenantId AND t.DeletedAt IS NULL
      WHERE c.ConversationId = @conversationId AND (c.TenantId = @tenantId OR @tenantId IS NULL)
    `);

    if (r.recordset.length === 0) return null;

    const row = r.recordset[0];
    return {
        ...row,
        Tags: row.TagsJson ? JSON.parse(row.TagsJson) : []
    };
}

/**
 * Lista conversas com base nas permissões do usuário (com paginação)
 */
export async function listConversations(user: UserContext, limit: number = 50, offset: number = 0) {
    const pool = await getPool();

    // Se for AGENTE, vê apenas as dele OU unassigned (em fila)
    let filterClause = "WHERE c.TenantId = @tenantId AND c.DeletedAt IS NULL";
    let messageFilter = "WHERE Direction = 'OUT' AND TenantId = @tenantId AND DeletedAt IS NULL";

    if (user.role === 'AGENT') {
        filterClause += ` AND (
            (c.AssignedUserId = @userId OR c.RequesterUserId = @userId)
            OR (
                c.Status = 'OPEN' AND c.AssignedUserId IS NULL 
                AND (
                    etm.ConnectorId IS NULL
                    OR NOT EXISTS (SELECT 1 FROM altdesk.InstanceAssignment ia WHERE ia.ConnectorId = etm.ConnectorId)
                    OR EXISTS (SELECT 1 FROM altdesk.InstanceAssignment ia WHERE ia.ConnectorId = etm.ConnectorId AND ia.UserId = @userId)
                )
            )
        )`;
    } else if (user.role === 'END_USER') {
        filterClause += " AND (c.RequesterUserId = @userId OR c.AssignedUserId = @userId)";
    } else if (user.role === 'SUPERADMIN') {
        // SUPERADMIN vê todas as conversas de todos os tenants
        filterClause = "WHERE c.DeletedAt IS NULL";
        messageFilter = "WHERE Direction = 'OUT' AND DeletedAt IS NULL";
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
             c.RequesterUserId,
             ch.Type AS SourceChannel, c.InteractionSequence, c.CreatedAt, c.ClosedAt,
             etm.ExternalUserId,
             q.Name AS QueueName,
             assignedUser.DisplayName AS AssignedUserName,
             assignedUser.Email AS AssignedUserEmail,
             ISNULL(ct.Name, requesterUser.DisplayName) AS ContactName,
             ct.CPF AS ContactCPF,
              ct.Phone AS ContactPhone,
              t.Priority, t.SlaStatus, t.SLAFirstResponseDue, t.SLAResolutionDue, t.EscalationLevel, t.ResolutionDescription,
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
                  AND m.DeletedAt IS NULL
              ) AS UnreadCount
      FROM altdesk.Conversation c
      LEFT JOIN altdesk.Channel ch ON ch.ChannelId = c.ChannelId
      LEFT JOIN altdesk.ExternalThreadMap etm ON etm.ConversationId = c.ConversationId
      LEFT JOIN altdesk.Queue q ON q.QueueId = c.QueueId
      LEFT JOIN altdesk.[User] assignedUser ON assignedUser.UserId = c.AssignedUserId
      LEFT JOIN altdesk.[User] requesterUser ON requesterUser.UserId = c.RequesterUserId
      LEFT JOIN altdesk.Contact ct ON ct.Phone = REPLACE(REPLACE(etm.ExternalUserId, '@s.whatsapp.net', ''), '@c.us', '') AND ct.TenantId = c.TenantId
      LEFT JOIN LastOutbound lo ON lo.ConversationId = c.ConversationId
      LEFT JOIN altdesk.Ticket t ON t.ConversationId = c.ConversationId AND t.TenantId = c.TenantId AND t.DeletedAt IS NULL
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
      SELECT m.MessageId, m.ExternalMessageId, m.Body, m.Direction, m.SenderExternalId, m.SenderUserId, m.MediaType, m.MediaUrl, m.Status, m.CreatedAt,
             u.Name AS SenderName
      FROM altdesk.Message m
      LEFT JOIN altdesk.[User] u ON u.UserId = m.SenderUserId
      WHERE m.ConversationId = @conversationId AND m.TenantId = @tenantId AND m.DeletedAt IS NULL
      ORDER BY m.CreatedAt DESC
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
        cc.ConfigJson,
        (SELECT TOP 1 m.ExternalMessageId 
         FROM altdesk.Message m 
         WHERE m.ConversationId = etm.ConversationId 
           AND m.Direction = 'IN' 
           AND m.ExternalMessageId IS NOT NULL
         ORDER BY m.CreatedAt DESC) as LastExternalMessageId,
        c.ContextData
      FROM altdesk.ExternalThreadMap etm
      JOIN altdesk.ChannelConnector cc ON cc.ConnectorId = etm.ConnectorId
      JOIN altdesk.Conversation c ON c.ConversationId = etm.ConversationId
      WHERE etm.ConversationId = @conversationId
        AND etm.TenantId = @tenantId
    `);

    if (r.recordset.length === 0) return null;

    const data = r.recordset[0];
    let contextData: any = {};
    try {
        if (data.ContextData) contextData = JSON.parse(data.ContextData);
    } catch (e) {}

    return {
        externalUserId: data.ExternalUserId,
        lastExternalMessageId: data.LastExternalMessageId,
        subject: contextData.subject || null,
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
export async function updateConversationStatus(conversationId: string, tenantId: string | null, status: string, resolution?: string) {
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

    // Sincronizar com a tabela Ticket e gravar ResolutionDescription se fornecido
    const request = pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .input("status", status);

    let ticketQuery = `
        UPDATE altdesk.Ticket
        SET Status = @status,
            ResolvedAt = CASE WHEN @status = 'RESOLVED' THEN SYSUTCDATETIME() ELSE NULL END,
            UpdatedAt = SYSUTCDATETIME()
    `;

    if (status === 'RESOLVED' && resolution !== undefined) {
        request.input("resolution", resolution);
        ticketQuery += `, ResolutionDescription = @resolution`;
    }

    ticketQuery += ` WHERE TenantId = @tenantId AND ConversationId = @conversationId`;

    await request.query(ticketQuery);
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
