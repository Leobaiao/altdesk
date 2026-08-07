import { getPool } from "../db.js";
import { logger } from "../lib/logger.js";
import { resolveConversationForInbound, saveInboundMessage } from "./conversation.js";
import { isWithinBusinessHours } from "./businessHoursService.js";

/**
 * Configuração padrão do widget — usada ao criar widget automaticamente
 * para novos tenants e como fallback se ConfigJson estiver vazio.
 */
export const DEFAULT_WIDGET_CONFIG = {
    corPrimaria: "#6C63FF",
    corFundo: "#FFFFFF",
    corTexto: "#1A1A2E",
    avatarUrl: "",
    launcherFormato: "circle",
    posicao: "bottom-right",
    tema: "light",
    fonte: "Inter",
    animacoesAtivas: true,
    autoOpen: false,
    autoOpenDelaySegundos: 5,
    gatilhoAbertura: "time",
    mensagemBoasVindas: "Olá! Como podemos ajudar?",
    mensagemForaHorario: "No momento estamos fora do horário de atendimento. Deixe sua mensagem e retornaremos em breve!",
    mensagemDespedida: "Obrigado pelo contato! Até logo.",
    quickReplies: [],
    camposFormulario: [],
    exigirEmail: false,
    exigirNome: false,
    exigirTelefone: false,
    camposCustomizados: [],
    somNotificacao: true,
    badgeAtivo: true,
    textoConsentimentoLgpd: "",
    altoContrasteDisponivel: false
};

/**
 * Busca a configuração do widget de um tenant (autenticado).
 */
export async function getWidgetConfig(tenantId: string) {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT WidgetId, TenantId, IsActive, ConfigJson, PublishedAt, CreatedAt, UpdatedAt
            FROM altdesk.ChatWidget
            WHERE TenantId = @tenantId AND DeletedAt IS NULL
        `);

    if (result.recordset.length === 0) return null;

    const row = result.recordset[0];
    let config = { ...DEFAULT_WIDGET_CONFIG };
    try {
        config = { ...DEFAULT_WIDGET_CONFIG, ...JSON.parse(row.ConfigJson || "{}") };
    } catch { }

    return {
        ...row,
        config,
        ConfigJson: undefined // Não expor o JSON bruto
    };
}

/**
 * Atualiza a configuração do widget (salva rascunho).
 */
export async function updateWidgetConfig(tenantId: string, configJson: Record<string, any>) {
    const pool = await getPool();
    const jsonStr = JSON.stringify(configJson);

    // Upsert: cria se não existir, atualiza se existir
    const existing = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT WidgetId FROM altdesk.ChatWidget WHERE TenantId = @tenantId AND DeletedAt IS NULL");

    if (existing.recordset.length === 0) {
        await pool.request()
            .input("tenantId", tenantId)
            .input("configJson", jsonStr)
            .query(`
                INSERT INTO altdesk.ChatWidget (TenantId, IsActive, ConfigJson)
                VALUES (@tenantId, 1, @configJson)
            `);
    } else {
        await pool.request()
            .input("tenantId", tenantId)
            .input("configJson", jsonStr)
            .query(`
                UPDATE altdesk.ChatWidget
                SET ConfigJson = @configJson, UpdatedAt = SYSUTCDATETIME()
                WHERE TenantId = @tenantId AND DeletedAt IS NULL
            `);
    }
}

/**
 * Publica o widget (marca como publicado e ativo).
 */
export async function publishWidget(tenantId: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .query(`
            UPDATE altdesk.ChatWidget
            SET PublishedAt = SYSUTCDATETIME(), IsActive = 1, UpdatedAt = SYSUTCDATETIME()
            WHERE TenantId = @tenantId AND DeletedAt IS NULL
        `);
}

/**
 * Retorna a configuração pública do widget (sem autenticação).
 * Só retorna se o widget está publicado e ativo.
 */
export async function getPublicWidgetConfig(tenantId: string) {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT ConfigJson
            FROM altdesk.ChatWidget
            WHERE TenantId = @tenantId AND IsActive = 1 AND PublishedAt IS NOT NULL AND DeletedAt IS NULL
        `);

    if (result.recordset.length === 0) return null;

    let config = { ...DEFAULT_WIDGET_CONFIG };
    try {
        config = { ...DEFAULT_WIDGET_CONFIG, ...JSON.parse(result.recordset[0].ConfigJson || "{}") };
    } catch { }

    return config;
}

/**
 * Processa mensagem recebida do widget.
 * Cria/reutiliza Contact e Conversation, salva Message, retorna dados para emit de socket.
 */
export async function handleWidgetMessage(
    tenantId: string,
    visitorId: string,
    text: string,
    visitorInfo?: { name?: string; email?: string; phone?: string }
) {
    const pool = await getPool();

    // 1. Garantir que existe um Channel WEBCHAT para o tenant
    let channelId: string;
    const channelCheck = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT TOP 1 ChannelId FROM altdesk.Channel WHERE TenantId = @tenantId AND Type = 'WEBCHAT' AND IsActive = 1");

    if (channelCheck.recordset.length > 0) {
        channelId = channelCheck.recordset[0].ChannelId;
    } else {
        const newChannel = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                INSERT INTO altdesk.Channel (TenantId, Name, Type, IsActive)
                OUTPUT inserted.ChannelId
                VALUES (@tenantId, N'Chat Widget', 'WEBCHAT', 1)
            `);
        channelId = newChannel.recordset[0].ChannelId;
    }

    // 2. Garantir que existe um ChannelConnector WEBCHAT
    const connectorId = `WEBCHAT_${tenantId}`;
    const connCheck = await pool.request()
        .input("connectorId", connectorId)
        .query("SELECT 1 FROM altdesk.ChannelConnector WHERE ConnectorId = @connectorId");

    if (connCheck.recordset.length === 0) {
        await pool.request()
            .input("connectorId", connectorId)
            .input("channelId", channelId)
            .query(`
                INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, IsActive)
                VALUES (@connectorId, @channelId, 'WEBCHAT', 1)
            `);
    }

    // 3. Criar/atualizar Contact
    let contactId: string;
    const contactPhone = visitorInfo?.phone || visitorId;
    const contactName = visitorInfo?.name || `Visitante ${visitorId.substring(0, 8)}`;

    const existingContact = await pool.request()
        .input("tenantId", tenantId)
        .input("phone", contactPhone)
        .query("SELECT TOP 1 ContactId FROM altdesk.Contact WHERE TenantId = @tenantId AND Phone = @phone AND DeletedAt IS NULL");

    if (existingContact.recordset.length > 0) {
        contactId = existingContact.recordset[0].ContactId;
        // Atualizar nome/email se fornecidos
        if (visitorInfo?.name || visitorInfo?.email) {
            const sets: string[] = [];
            const req = pool.request()
                .input("contactId", contactId)
                .input("tenantId", tenantId);
            if (visitorInfo.name) { sets.push("Name = @name"); req.input("name", visitorInfo.name); }
            if (visitorInfo.email) { sets.push("Email = @email"); req.input("email", visitorInfo.email); }
            sets.push("LastActivityAt = SYSUTCDATETIME()");
            if (sets.length > 0) {
                await req.query(`UPDATE altdesk.Contact SET ${sets.join(", ")} WHERE ContactId = @contactId AND TenantId = @tenantId`);
            }
        }
    } else {
        const newContact = await pool.request()
            .input("tenantId", tenantId)
            .input("name", contactName)
            .input("phone", contactPhone)
            .input("email", visitorInfo?.email || null)
            .input("source", "WEBCHAT")
            .input("channelType", "Web")
            .query(`
                INSERT INTO altdesk.Contact (TenantId, Name, Phone, Email, Source, ChannelType, LastActivityAt)
                OUTPUT inserted.ContactId
                VALUES (@tenantId, @name, @phone, @email, @source, @channelType, SYSUTCDATETIME())
            `);
        contactId = newContact.recordset[0].ContactId;
    }

    // 4. Encontrar ou criar conversa para este visitante
    const existingConv = await pool.request()
        .input("tenantId", tenantId)
        .input("visitorId", visitorId)
        .input("connectorId", connectorId)
        .query(`
            SELECT TOP 1 c.ConversationId 
            FROM altdesk.Conversation c
            INNER JOIN altdesk.ExternalThreadMap m ON m.ConversationId = c.ConversationId
            WHERE c.TenantId = @tenantId 
              AND m.ConnectorId = @connectorId
              AND m.ExternalUserId = @visitorId
              AND c.Status IN ('OPEN', 'SNOOZED')
              AND c.DeletedAt IS NULL
            ORDER BY c.CreatedAt DESC
        `);

    let conversationId: string;
    if (existingConv.recordset.length > 0) {
        conversationId = existingConv.recordset[0].ConversationId;
    } else {
        // Criar nova conversa
        const title = contactName;
        const newConv = await pool.request()
            .input("tenantId", tenantId)
            .input("channelId", channelId)
            .input("title", title)
            .query(`
                INSERT INTO altdesk.Conversation (TenantId, ChannelId, Title, Kind, Status, SourceChannel)
                OUTPUT inserted.ConversationId, inserted.CreatedAt
                VALUES (@tenantId, @channelId, @title, 'DIRECT', 'OPEN', 'WEBCHAT')
            `);
        conversationId = newConv.recordset[0].ConversationId;

        // Criar mapeamento de thread externo
        await pool.request()
            .input("tenantId", tenantId)
            .input("connectorId", connectorId)
            .input("externalChatId", visitorId)
            .input("externalUserId", visitorId)
            .input("conversationId", conversationId)
            .query(`
                INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                VALUES (@tenantId, @connectorId, @externalChatId, @externalUserId, @conversationId)
            `);
    }

    // 5. Salvar mensagem
    const msgResult = await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .input("body", text)
        .input("senderExternalId", visitorId)
        .query(`
            INSERT INTO altdesk.Message (TenantId, ConversationId, Direction, SenderExternalId, Body, Status)
            OUTPUT inserted.MessageId, inserted.CreatedAt
            VALUES (@tenantId, @conversationId, 'IN', @senderExternalId, @body, 'SENT')
        `);

    const messageId = msgResult.recordset[0].MessageId;
    const messageCreatedAt = msgResult.recordset[0].CreatedAt;

    // 6. Atualizar LastMessageAt da conversa
    await pool.request()
        .input("conversationId", conversationId)
        .query("UPDATE altdesk.Conversation SET LastMessageAt = SYSUTCDATETIME() WHERE ConversationId = @conversationId");

    return {
        conversationId,
        messageId,
        createdAt: messageCreatedAt,
        contactId,
        contactName,
        visitorId,
        text
    };
}

/**
 * Retorna o histórico de mensagens de uma conversa do widget.
 */
export async function getWidgetConversationHistory(tenantId: string, visitorId: string) {
    const pool = await getPool();
    const connectorId = `WEBCHAT_${tenantId}`;

    // Encontrar conversa ativa para este visitante
    const convResult = await pool.request()
        .input("tenantId", tenantId)
        .input("visitorId", visitorId)
        .input("connectorId", connectorId)
        .query(`
            SELECT TOP 1 c.ConversationId
            FROM altdesk.Conversation c
            INNER JOIN altdesk.ExternalThreadMap m ON m.ConversationId = c.ConversationId
            WHERE c.TenantId = @tenantId
              AND m.ConnectorId = @connectorId
              AND m.ExternalUserId = @visitorId
              AND c.DeletedAt IS NULL
            ORDER BY c.CreatedAt DESC
        `);

    if (convResult.recordset.length === 0) return [];

    const conversationId = convResult.recordset[0].ConversationId;

    const messages = await pool.request()
        .input("conversationId", conversationId)
        .query(`
            SELECT MessageId, Direction, Body, MediaType, MediaUrl, CreatedAt
            FROM altdesk.Message
            WHERE ConversationId = @conversationId AND DeletedAt IS NULL AND Direction != 'INTERNAL'
            ORDER BY CreatedAt ASC
        `);

    return messages.recordset.map((m: any) => ({
        id: m.MessageId,
        direction: m.Direction,
        body: m.Body,
        mediaType: m.MediaType,
        mediaUrl: m.MediaUrl,
        createdAt: m.CreatedAt
    }));
}

/**
 * Verifica se o tenant está dentro do horário comercial.
 */
export async function checkWidgetAvailability(tenantId: string): Promise<{ online: boolean; message?: string }> {
    try {
        const available = await isWithinBusinessHours(tenantId);
        if (available) {
            return { online: true };
        }
        // Buscar mensagem de fora do horário da config do widget
        const config = await getPublicWidgetConfig(tenantId);
        return {
            online: false,
            message: config?.mensagemForaHorario || "Estamos fora do horário de atendimento."
        };
    } catch (err) {
        // Se não tem horário configurado, assume online
        logger.warn({ tenantId, err }, "[Widget] Erro ao verificar horário comercial, assumindo online");
        return { online: true };
    }
}

/**
 * Cria widget padrão para um tenant (usado no onboarding).
 */
export async function createDefaultWidget(tenantId: string) {
    const pool = await getPool();
    const existing = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT 1 FROM altdesk.ChatWidget WHERE TenantId = @tenantId");

    if (existing.recordset.length > 0) return;

    await pool.request()
        .input("tenantId", tenantId)
        .input("configJson", JSON.stringify(DEFAULT_WIDGET_CONFIG))
        .query(`
            INSERT INTO altdesk.ChatWidget (TenantId, IsActive, ConfigJson)
            VALUES (@tenantId, 1, @configJson)
        `);
}
