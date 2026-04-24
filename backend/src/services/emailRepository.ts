/**
 * ============================================================================
 * AltDesk Email Integration — Repository (Acesso à BD)
 * ============================================================================
 * 
 * Funções CRUD para as tabelas de email integration.
 * Todas as operações de password/token passam pela camada de encriptação.
 * 
 * Convenção: funções são agrupadas por tabela e seguem o padrão
 * get/create/update/delete + NomeDaEntidade.
 */

import { getPool } from "../db.js";
import { encrypt, decrypt, isEncrypted } from "../lib/encryption.js";
import { logger } from "../lib/logger.js";
import type {
    EmailChannel,
    CreateEmailChannelInput,
    EmailInboundSettings,
    EmailOutboundSettings,
    UpsertInboundSettingsInput,
    UpsertOutboundSettingsInput,
    EmailInboundEvent,
    EmailMessageMeta,
    ProcessingStatus,
    EmailRetryItem,
} from "../types/emailTypes.js";

// ============================================================================
// EMAIL CHANNELS
// ============================================================================

/**
 * Busca todos os canais de email activos.
 * Se tenantId for fornecido, filtra por tenant.
 * Usado pelo worker de polling para iterar sobre todos os canais.
 */
export async function getActiveEmailChannels(tenantId?: string): Promise<EmailChannel[]> {
    const pool = await getPool();
    const req = pool.request();

    let query = `
        SELECT * FROM altdesk.EmailChannel
        WHERE IsActive = 1 AND DeletedAt IS NULL
    `;

    if (tenantId) {
        query += ` AND TenantId = @tenantId`;
        req.input("tenantId", tenantId);
    }

    query += ` ORDER BY CreatedAt ASC`;

    const result = await req.query(query);
    return result.recordset;
}

/**
 * Busca um canal de email pelo ID.
 */
export async function getEmailChannelById(channelId: string): Promise<EmailChannel | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("channelId", channelId)
        .query(`SELECT * FROM altdesk.EmailChannel WHERE EmailChannelId = @channelId AND DeletedAt IS NULL`);

    return result.recordset[0] || null;
}

/**
 * Busca todos os canais de email de um tenant (incluindo inativos, para a API de gestão).
 */
export async function getEmailChannelsByTenant(tenantId: string): Promise<EmailChannel[]> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT * FROM altdesk.EmailChannel
            WHERE TenantId = @tenantId AND DeletedAt IS NULL
            ORDER BY CreatedAt DESC
        `);

    return result.recordset;
}

/**
 * Cria um novo canal de email.
 */
export async function createEmailChannel(data: CreateEmailChannelInput): Promise<EmailChannel> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", data.TenantId)
        .input("name", data.Name)
        .input("emailAddress", data.EmailAddress)
        .input("providerType", data.ProviderType || "imap_smtp")
        .input("defaultQueueId", data.DefaultQueueId || null)
        .query(`
            INSERT INTO altdesk.EmailChannel (TenantId, Name, EmailAddress, ProviderType, DefaultQueueId)
            OUTPUT inserted.*
            VALUES (@tenantId, @name, @emailAddress, @providerType, @defaultQueueId)
        `);

    logger.info(
        { channelId: result.recordset[0].EmailChannelId, tenantId: data.TenantId, email: data.EmailAddress },
        "[EmailRepo] Channel created"
    );

    return result.recordset[0];
}

/**
 * Atualiza campos de um canal de email.
 */
export async function updateEmailChannel(channelId: string, data: Partial<Pick<EmailChannel, 'Name' | 'EmailAddress' | 'ProviderType' | 'IsActive' | 'DefaultQueueId'>>): Promise<void> {
    const pool = await getPool();
    const sets: string[] = ["UpdatedAt = SYSUTCDATETIME()"];
    const req = pool.request().input("channelId", channelId);

    if (data.Name !== undefined) {
        sets.push("Name = @name");
        req.input("name", data.Name);
    }
    if (data.EmailAddress !== undefined) {
        sets.push("EmailAddress = @emailAddress");
        req.input("emailAddress", data.EmailAddress);
    }
    if (data.ProviderType !== undefined) {
        sets.push("ProviderType = @providerType");
        req.input("providerType", data.ProviderType);
    }
    if (data.IsActive !== undefined) {
        sets.push("IsActive = @isActive");
        req.input("isActive", data.IsActive);
    }
    if (data.DefaultQueueId !== undefined) {
        sets.push("DefaultQueueId = @defaultQueueId");
        req.input("defaultQueueId", data.DefaultQueueId);
    }

    await req.query(`
        UPDATE altdesk.EmailChannel SET ${sets.join(", ")}
        WHERE EmailChannelId = @channelId AND DeletedAt IS NULL
    `);
}

/**
 * Soft-delete de um canal de email.
 */
export async function deleteEmailChannel(channelId: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
        .input("channelId", channelId)
        .query(`
            UPDATE altdesk.EmailChannel 
            SET DeletedAt = SYSUTCDATETIME(), IsActive = 0, UpdatedAt = SYSUTCDATETIME()
            WHERE EmailChannelId = @channelId
        `);
}

// ============================================================================
// INBOUND SETTINGS
// ============================================================================

/**
 * Busca as configurações de entrada de um canal.
 * ⚠️ Retorna passwords/tokens ENCRIPTADOS. Usar decrypt() quando for necessário
 * passar ao provider.
 */
export async function getInboundSettings(channelId: string): Promise<EmailInboundSettings | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("channelId", channelId)
        .query(`SELECT * FROM altdesk.EmailInboundSettings WHERE EmailChannelId = @channelId`);

    return result.recordset[0] || null;
}

/**
 * Cria ou atualiza as configurações de entrada.
 * Passwords são automaticamente encriptadas antes de guardar.
 */
export async function upsertInboundSettings(channelId: string, data: UpsertInboundSettingsInput): Promise<void> {
    const pool = await getPool();

    // Encriptar a password se foi fornecida
    let encryptedPassword: string | null = null;
    if (data.Password) {
        encryptedPassword = encrypt(data.Password);
    }

    // Verificar se já existem settings
    const existing = await pool.request()
        .input("channelId", channelId)
        .query(`SELECT 1 FROM altdesk.EmailInboundSettings WHERE EmailChannelId = @channelId`);

    if (existing.recordset.length > 0) {
        // UPDATE — só atualiza os campos fornecidos
        const sets: string[] = [];
        const req = pool.request().input("channelId", channelId);

        if (data.Protocol !== undefined) { sets.push("Protocol = @protocol"); req.input("protocol", data.Protocol); }
        if (data.ImapHost !== undefined) { sets.push("ImapHost = @imapHost"); req.input("imapHost", data.ImapHost); }
        if (data.ImapPort !== undefined) { sets.push("ImapPort = @imapPort"); req.input("imapPort", data.ImapPort); }
        if (data.ImapSecure !== undefined) { sets.push("ImapSecure = @imapSecure"); req.input("imapSecure", data.ImapSecure); }
        if (data.Username !== undefined) { sets.push("Username = @username"); req.input("username", data.Username); }
        if (encryptedPassword) { sets.push("EncryptedPassword = @encPass"); req.input("encPass", encryptedPassword); }
        if (data.PollIntervalSeconds !== undefined) { sets.push("PollIntervalSeconds = @pollInterval"); req.input("pollInterval", data.PollIntervalSeconds); }

        if (sets.length > 0) {
            await req.query(`UPDATE altdesk.EmailInboundSettings SET ${sets.join(", ")} WHERE EmailChannelId = @channelId`);
        }
    } else {
        // INSERT
        await pool.request()
            .input("channelId", channelId)
            .input("protocol", data.Protocol || "IMAP")
            .input("imapHost", data.ImapHost || null)
            .input("imapPort", data.ImapPort || 993)
            .input("imapSecure", data.ImapSecure !== undefined ? data.ImapSecure : true)
            .input("username", data.Username || null)
            .input("encPass", encryptedPassword)
            .input("pollInterval", data.PollIntervalSeconds || 60)
            .query(`
                INSERT INTO altdesk.EmailInboundSettings (EmailChannelId, Protocol, ImapHost, ImapPort, ImapSecure, Username, EncryptedPassword, PollIntervalSeconds)
                VALUES (@channelId, @protocol, @imapHost, @imapPort, @imapSecure, @username, @encPass, @pollInterval)
            `);
    }

    logger.info({ channelId }, "[EmailRepo] Inbound settings upserted");
}

// ============================================================================
// OUTBOUND SETTINGS
// ============================================================================

/**
 * Busca as configurações de saída de um canal.
 * ⚠️ Retorna passwords/tokens ENCRIPTADOS.
 */
export async function getOutboundSettings(channelId: string): Promise<EmailOutboundSettings | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("channelId", channelId)
        .query(`SELECT * FROM altdesk.EmailOutboundSettings WHERE EmailChannelId = @channelId`);

    return result.recordset[0] || null;
}

/**
 * Cria ou atualiza as configurações de saída.
 * Passwords são automaticamente encriptadas antes de guardar.
 */
export async function upsertOutboundSettings(channelId: string, data: UpsertOutboundSettingsInput): Promise<void> {
    const pool = await getPool();

    let encryptedPassword: string | null = null;
    if (data.Password) {
        encryptedPassword = encrypt(data.Password);
    }

    const existing = await pool.request()
        .input("channelId", channelId)
        .query(`SELECT 1 FROM altdesk.EmailOutboundSettings WHERE EmailChannelId = @channelId`);

    if (existing.recordset.length > 0) {
        const sets: string[] = [];
        const req = pool.request().input("channelId", channelId);

        if (data.Protocol !== undefined) { sets.push("Protocol = @protocol"); req.input("protocol", data.Protocol); }
        if (data.SmtpHost !== undefined) { sets.push("SmtpHost = @smtpHost"); req.input("smtpHost", data.SmtpHost); }
        if (data.SmtpPort !== undefined) { sets.push("SmtpPort = @smtpPort"); req.input("smtpPort", data.SmtpPort); }
        if (data.SmtpSecure !== undefined) { sets.push("SmtpSecure = @smtpSecure"); req.input("smtpSecure", data.SmtpSecure); }
        if (data.Username !== undefined) { sets.push("Username = @username"); req.input("username", data.Username); }
        if (encryptedPassword) { sets.push("EncryptedPassword = @encPass"); req.input("encPass", encryptedPassword); }
        if (data.FromName !== undefined) { sets.push("FromName = @fromName"); req.input("fromName", data.FromName); }
        if (data.FromAddress !== undefined) { sets.push("FromAddress = @fromAddr"); req.input("fromAddr", data.FromAddress); }
        if (data.ReplyToAddress !== undefined) { sets.push("ReplyToAddress = @replyTo"); req.input("replyTo", data.ReplyToAddress); }

        if (sets.length > 0) {
            await req.query(`UPDATE altdesk.EmailOutboundSettings SET ${sets.join(", ")} WHERE EmailChannelId = @channelId`);
        }
    } else {
        await pool.request()
            .input("channelId", channelId)
            .input("protocol", data.Protocol || "SMTP")
            .input("smtpHost", data.SmtpHost || null)
            .input("smtpPort", data.SmtpPort || 587)
            .input("smtpSecure", data.SmtpSecure !== undefined ? data.SmtpSecure : false)
            .input("username", data.Username || null)
            .input("encPass", encryptedPassword)
            .input("fromName", data.FromName || null)
            .input("fromAddr", data.FromAddress || null)
            .input("replyTo", data.ReplyToAddress || null)
            .query(`
                INSERT INTO altdesk.EmailOutboundSettings (EmailChannelId, Protocol, SmtpHost, SmtpPort, SmtpSecure, Username, EncryptedPassword, FromName, FromAddress, ReplyToAddress)
                VALUES (@channelId, @protocol, @smtpHost, @smtpPort, @smtpSecure, @username, @encPass, @fromName, @fromAddr, @replyTo)
            `);
    }

    logger.info({ channelId }, "[EmailRepo] Outbound settings upserted");
}

/**
 * Helper: desencripta a password de inbound settings.
 * Retorna null se não houver password.
 */
export function decryptInboundPassword(settings: EmailInboundSettings): string | null {
    if (!settings.EncryptedPassword) return null;
    try {
        return decrypt(settings.EncryptedPassword);
    } catch (err) {
        logger.error({ err, channelId: settings.EmailChannelId }, "[EmailRepo] Failed to decrypt inbound password");
        return null;
    }
}

/**
 * Helper: desencripta a password de outbound settings.
 */
export function decryptOutboundPassword(settings: EmailOutboundSettings): string | null {
    if (!settings.EncryptedPassword) return null;
    try {
        return decrypt(settings.EncryptedPassword);
    } catch (err) {
        logger.error({ err, channelId: settings.EmailChannelId }, "[EmailRepo] Failed to decrypt outbound password");
        return null;
    }
}

// ============================================================================
// INBOUND EVENTS
// ============================================================================

/**
 * Salva um novo inbound event (email recebido).
 * É o primeiro passo antes do processamento — regista o email com status "pending".
 */
export async function saveInboundEvent(event: Omit<EmailInboundEvent, 'EventId' | 'ProcessingStatus' | 'ErrorMessage' | 'RetryCount' | 'ConversationId' | 'MessageId' | 'CreatedAt' | 'ProcessedAt'>): Promise<string> {
    const pool = await getPool();
    const result = await pool.request()
        .input("emailChannelId", event.EmailChannelId)
        .input("tenantId", event.TenantId)
        .input("messageIdHeader", event.MessageIdHeader)
        .input("inReplyTo", event.InReplyTo)
        .input("referencesHeader", event.ReferencesHeader)
        .input("fromAddress", event.FromAddress)
        .input("fromName", event.FromName)
        .input("toAddress", event.ToAddress)
        .input("subject", event.Subject)
        .input("bodyText", event.BodyText)
        .input("bodyHtml", event.BodyHtml)
        .input("attachmentsJson", event.AttachmentsJson)
        .input("rawHeadersJson", event.RawHeadersJson)
        .query(`
            INSERT INTO altdesk.EmailInboundEvent 
                (EmailChannelId, TenantId, MessageIdHeader, InReplyTo, ReferencesHeader,
                 FromAddress, FromName, ToAddress, Subject, BodyText, BodyHtml,
                 AttachmentsJson, RawHeadersJson)
            OUTPUT inserted.EventId
            VALUES 
                (@emailChannelId, @tenantId, @messageIdHeader, @inReplyTo, @referencesHeader,
                 @fromAddress, @fromName, @toAddress, @subject, @bodyText, @bodyHtml,
                 @attachmentsJson, @rawHeadersJson)
        `);

    return result.recordset[0].EventId;
}

/**
 * Atualiza o status de processamento de um inbound event.
 */
export async function updateEventStatus(
    eventId: string,
    status: ProcessingStatus,
    updates?: { errorMessage?: string; conversationId?: string; messageId?: string }
): Promise<void> {
    const pool = await getPool();
    const req = pool.request()
        .input("eventId", eventId)
        .input("status", status);

    let extraSets = "";

    if (updates?.errorMessage !== undefined) {
        extraSets += ", ErrorMessage = @errorMsg, RetryCount = RetryCount + 1";
        req.input("errorMsg", updates.errorMessage);
    }
    if (updates?.conversationId) {
        extraSets += ", ConversationId = @convId";
        req.input("convId", updates.conversationId);
    }
    if (updates?.messageId) {
        extraSets += ", MessageId = @msgId";
        req.input("msgId", updates.messageId);
    }
    if (status === "processed") {
        extraSets += ", ProcessedAt = SYSUTCDATETIME()";
    }

    await req.query(`
        UPDATE altdesk.EmailInboundEvent 
        SET ProcessingStatus = @status ${extraSets}
        WHERE EventId = @eventId
    `);
}

/**
 * Verifica se um email já foi processado (deduplicação por MessageIdHeader).
 */
export async function isEmailAlreadyProcessed(tenantId: string, messageIdHeader: string): Promise<boolean> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("messageIdHeader", messageIdHeader)
        .query(`
            SELECT TOP 1 1 FROM altdesk.EmailInboundEvent
            WHERE TenantId = @tenantId 
              AND MessageIdHeader = @messageIdHeader
              AND ProcessingStatus IN ('processed', 'processing')
        `);

    return result.recordset.length > 0;
}

// ============================================================================
// EMAIL MESSAGE META (Threading)
// ============================================================================

/**
 * Salva os metadados de threading de uma mensagem de email.
 * Chamado tanto para emails recebidos como para emails enviados pelo agente.
 */
export async function saveEmailMessageMeta(meta: Omit<EmailMessageMeta, 'Id' | 'CreatedAt'>): Promise<string> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", meta.TenantId)
        .input("conversationId", meta.ConversationId)
        .input("messageId", meta.MessageId)
        .input("emailChannelId", meta.EmailChannelId)
        .input("emailMessageIdHeader", meta.EmailMessageIdHeader)
        .input("inReplyTo", meta.InReplyTo)
        .input("referencesHeader", meta.ReferencesHeader)
        .input("direction", meta.Direction)
        .query(`
            INSERT INTO altdesk.EmailMessageMeta 
                (TenantId, ConversationId, MessageId, EmailChannelId, EmailMessageIdHeader, InReplyTo, ReferencesHeader, Direction)
            OUTPUT inserted.Id
            VALUES 
                (@tenantId, @conversationId, @messageId, @emailChannelId, @emailMessageIdHeader, @inReplyTo, @referencesHeader, @direction)
        `);

    return result.recordset[0].Id;
}

/**
 * Busca ConversationId por um EmailMessageIdHeader.
 * 
 * Este é o CORAÇÃO da correlação (Nível 1):
 * Quando um cliente responde, o email dele tem In-Reply-To: <message-id-anterior>.
 * Procuramos esse message-id aqui para encontrar a conversa/ticket.
 */
export async function findConversationByEmailMessageId(tenantId: string, emailMessageIdHeader: string): Promise<string | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("msgIdHeader", emailMessageIdHeader)
        .query(`
            SELECT TOP 1 ConversationId 
            FROM altdesk.EmailMessageMeta
            WHERE TenantId = @tenantId AND EmailMessageIdHeader = @msgIdHeader
            ORDER BY CreatedAt DESC
        `);

    return result.recordset[0]?.ConversationId || null;
}

/**
 * Busca ConversationId por uma lista de References.
 * 
 * Correlação Nível 2: Se In-Reply-To não resolveu, tentamos os References.
 * O header References contém toda a cadeia de Message-IDs da thread.
 */
export async function findConversationByReferences(tenantId: string, references: string[]): Promise<string | null> {
    if (references.length === 0) return null;

    const pool = await getPool();

    // Procurar qualquer um dos Message-IDs da lista de References
    // Começamos pelo mais recente (último da lista) que tende a ser mais específico
    for (const ref of [...references].reverse()) {
        const result = await pool.request()
            .input("tenantId", tenantId)
            .input("ref", ref.trim())
            .query(`
                SELECT TOP 1 ConversationId 
                FROM altdesk.EmailMessageMeta
                WHERE TenantId = @tenantId AND EmailMessageIdHeader = @ref
                ORDER BY CreatedAt DESC
            `);

        if (result.recordset.length > 0) {
            return result.recordset[0].ConversationId;
        }
    }

    return null;
}

/**
 * Busca os últimos metadados de email de uma conversa (para construir headers de resposta).
 * Usado quando o agente responde: precisamos do Message-ID anterior para o In-Reply-To.
 */
export async function getLatestEmailMetaForConversation(conversationId: string): Promise<EmailMessageMeta | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("conversationId", conversationId)
        .query(`
            SELECT TOP 1 * FROM altdesk.EmailMessageMeta
            WHERE ConversationId = @conversationId
            ORDER BY CreatedAt DESC
        `);

    return result.recordset[0] || null;
}

/**
 * Busca toda a cadeia de Message-IDs de uma conversa (para o header References).
 */
export async function getEmailThreadMessageIds(conversationId: string): Promise<string[]> {
    const pool = await getPool();
    const result = await pool.request()
        .input("conversationId", conversationId)
        .query(`
            SELECT EmailMessageIdHeader FROM altdesk.EmailMessageMeta
            WHERE ConversationId = @conversationId
            ORDER BY CreatedAt ASC
        `);

    return result.recordset.map(r => r.EmailMessageIdHeader);
}

// ============================================================================
// CHANNEL SYNC STATUS
// ============================================================================

/**
 * Atualiza o estado de sync de um canal após polling.
 * Chamado pelo worker após cada ciclo de fetch.
 */
export async function updateChannelSyncStatus(
    channelId: string,
    success: boolean,
    error?: string
): Promise<void> {
    const pool = await getPool();

    if (success) {
        await pool.request()
            .input("channelId", channelId)
            .query(`
                UPDATE altdesk.EmailChannel 
                SET LastSyncAt = SYSUTCDATETIME(),
                    LastError = NULL,
                    ConsecutiveFailureCount = 0,
                    UpdatedAt = SYSUTCDATETIME()
                WHERE EmailChannelId = @channelId
            `);
    } else {
        await pool.request()
            .input("channelId", channelId)
            .input("error", error || "Unknown error")
            .query(`
                UPDATE altdesk.EmailChannel 
                SET LastError = @error,
                    ConsecutiveFailureCount = ConsecutiveFailureCount + 1,
                    UpdatedAt = SYSUTCDATETIME()
                WHERE EmailChannelId = @channelId
            `);
    }
}

/**
 * Atualiza o último UID processado de um canal (para IMAP incremental).
 */
export async function updateLastProcessedUid(channelId: string, uid: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
        .input("channelId", channelId)
        .input("uid", uid)
        .query(`
            UPDATE altdesk.EmailInboundSettings 
            SET LastProcessedUid = @uid
            WHERE EmailChannelId = @channelId
        `);
}

// ============================================================================
// RETRY QUEUE
// ============================================================================

/**
 * Adiciona um email à fila de retry.
 */
export async function enqueueEmailRetry(item: Omit<EmailRetryItem, 'RetryId' | 'Status' | 'RetryCount' | 'MaxRetries' | 'NextRetryAt' | 'LastError' | 'CreatedAt' | 'SentAt'>): Promise<string> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", item.TenantId)
        .input("emailChannelId", item.EmailChannelId)
        .input("conversationId", item.ConversationId)
        .input("toAddress", item.ToAddress)
        .input("subject", item.Subject)
        .input("bodyHtml", item.BodyHtml)
        .input("bodyText", item.BodyText)
        .input("inReplyTo", item.InReplyTo)
        .input("referencesHeader", item.ReferencesHeader)
        .input("attachmentsJson", item.AttachmentsJson)
        .query(`
            INSERT INTO altdesk.EmailRetryQueue 
                (TenantId, EmailChannelId, ConversationId, ToAddress, Subject, BodyHtml, BodyText, InReplyTo, ReferencesHeader, AttachmentsJson)
            OUTPUT inserted.RetryId
            VALUES 
                (@tenantId, @emailChannelId, @conversationId, @toAddress, @subject, @bodyHtml, @bodyText, @inReplyTo, @referencesHeader, @attachmentsJson)
        `);

    return result.recordset[0].RetryId;
}

/**
 * Busca items pendentes da retry queue que estão prontos para reprocessar.
 */
export async function getPendingRetries(): Promise<EmailRetryItem[]> {
    const pool = await getPool();
    const result = await pool.request()
        .query(`
            SELECT * FROM altdesk.EmailRetryQueue
            WHERE Status IN ('pending', 'retrying')
              AND NextRetryAt <= SYSUTCDATETIME()
              AND RetryCount < MaxRetries
            ORDER BY NextRetryAt ASC
        `);

    return result.recordset;
}

/**
 * Atualiza um item da retry queue após tentativa.
 */
export async function updateRetryItem(
    retryId: string,
    success: boolean,
    error?: string
): Promise<void> {
    const pool = await getPool();

    if (success) {
        await pool.request()
            .input("retryId", retryId)
            .query(`
                UPDATE altdesk.EmailRetryQueue 
                SET Status = 'sent', SentAt = SYSUTCDATETIME()
                WHERE RetryId = @retryId
            `);
    } else {
        // Calcular backoff exponencial: 30s, 60s, 2min, 5min, 15min
        await pool.request()
            .input("retryId", retryId)
            .input("error", error || "Unknown error")
            .query(`
                UPDATE altdesk.EmailRetryQueue 
                SET Status = CASE WHEN RetryCount + 1 >= MaxRetries THEN 'failed_permanent' ELSE 'retrying' END,
                    RetryCount = RetryCount + 1,
                    LastError = @error,
                    NextRetryAt = DATEADD(second, 
                        CASE RetryCount
                            WHEN 0 THEN 30
                            WHEN 1 THEN 60
                            WHEN 2 THEN 120
                            WHEN 3 THEN 300
                            ELSE 900
                        END,
                        SYSUTCDATETIME()
                    )
                WHERE RetryId = @retryId
            `);
    }
}
