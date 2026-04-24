/**
 * ============================================================================
 * AltDesk Email Integration — Type Definitions
 * ============================================================================
 * 
 * Interfaces TypeScript correspondentes às tabelas de email integration.
 * Estes tipos são usados em todo o módulo de email: repositórios, providers,
 * motor de correlação e worker.
 */

// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

/** Tipos de provider de email suportados */
export type EmailProviderType = 'imap_smtp' | 'gmail' | 'microsoft';

/** Protocolos de entrada */
export type InboundProtocol = 'IMAP' | 'GMAIL_API' | 'GRAPH_API';

/** Protocolos de saída */
export type OutboundProtocol = 'SMTP' | 'GMAIL_API' | 'GRAPH_API';

/** Estados de processamento de um inbound event */
export type ProcessingStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'duplicate';

/** Estados da retry queue */
export type RetryStatus = 'pending' | 'retrying' | 'sent' | 'failed_permanent';

// ---------------------------------------------------------------------------
// Email Channel (Tabela principal)
// ---------------------------------------------------------------------------

/** Configuração principal de um canal de email (1 canal = 1 caixa de email) */
export interface EmailChannel {
    EmailChannelId: string;
    TenantId: string;
    Name: string;                          // Nome amigável (ex: "Suporte Geral")
    EmailAddress: string;                  // suporte@empresa.com
    ProviderType: EmailProviderType;       // imap_smtp | gmail | microsoft
    IsActive: boolean;
    DefaultQueueId: string | null;         // Fila padrão para tickets novos
    LastSyncAt: Date | null;               // Último polling bem-sucedido
    LastError: string | null;
    ConsecutiveFailureCount: number;
    CreatedAt: Date;
    UpdatedAt: Date;
    DeletedAt: Date | null;
}

/** Input para criar um novo canal de email */
export interface CreateEmailChannelInput {
    TenantId: string;
    Name: string;
    EmailAddress: string;
    ProviderType?: EmailProviderType;
    DefaultQueueId?: string | null;
}

// ---------------------------------------------------------------------------
// Inbound Settings (Configuração de entrada)
// ---------------------------------------------------------------------------

/** Configuração de entrada (IMAP ou OAuth) */
export interface EmailInboundSettings {
    EmailChannelId: string;
    Protocol: InboundProtocol;
    ImapHost: string | null;
    ImapPort: number | null;
    ImapSecure: boolean | null;
    Username: string | null;
    EncryptedPassword: string | null;      // ⚠️ AES-256 encrypted — nunca logar!
    OAuthAccessToken: string | null;       // ⚠️ AES-256 encrypted
    OAuthRefreshToken: string | null;      // ⚠️ AES-256 encrypted
    OAuthExpiresAt: Date | null;
    LastProcessedUid: string | null;       // Último UID IMAP processado
    PollIntervalSeconds: number;
}

/** Input para criar/atualizar inbound settings (campos em plaintext antes de encrypt) */
export interface UpsertInboundSettingsInput {
    Protocol?: InboundProtocol;
    ImapHost?: string;
    ImapPort?: number;
    ImapSecure?: boolean;
    Username?: string;
    Password?: string;                     // Plaintext — será criptografado pelo repositório
    PollIntervalSeconds?: number;
}

// ---------------------------------------------------------------------------
// Outbound Settings (Configuração de saída)
// ---------------------------------------------------------------------------

/** Configuração de saída (SMTP ou OAuth) */
export interface EmailOutboundSettings {
    EmailChannelId: string;
    Protocol: OutboundProtocol;
    SmtpHost: string | null;
    SmtpPort: number | null;
    SmtpSecure: boolean | null;
    Username: string | null;
    EncryptedPassword: string | null;      // ⚠️ AES-256 encrypted
    OAuthAccessToken: string | null;       // ⚠️ AES-256 encrypted
    OAuthRefreshToken: string | null;      // ⚠️ AES-256 encrypted
    OAuthExpiresAt: Date | null;
    FromName: string | null;
    FromAddress: string | null;
    ReplyToAddress: string | null;
}

/** Input para criar/atualizar outbound settings (campos em plaintext) */
export interface UpsertOutboundSettingsInput {
    Protocol?: OutboundProtocol;
    SmtpHost?: string;
    SmtpPort?: number;
    SmtpSecure?: boolean;
    Username?: string;
    Password?: string;                     // Plaintext — será criptografado pelo repositório
    FromName?: string;
    FromAddress?: string;
    ReplyToAddress?: string;
}

// ---------------------------------------------------------------------------
// Inbound Event (Cada email recebido — log de processamento)
// ---------------------------------------------------------------------------

/** Registo de um email recebido, antes e durante processamento */
export interface EmailInboundEvent {
    EventId: string;
    EmailChannelId: string;
    TenantId: string;

    // Headers de threading
    MessageIdHeader: string | null;        // Message-ID do email
    InReplyTo: string | null;
    ReferencesHeader: string | null;       // Lista de Message-IDs (separados por espaço)

    // Dados do email
    FromAddress: string;
    FromName: string | null;
    ToAddress: string;
    Subject: string | null;
    BodyText: string | null;
    BodyHtml: string | null;
    AttachmentsJson: string | null;
    RawHeadersJson: string | null;

    // Estado
    ProcessingStatus: ProcessingStatus;
    ErrorMessage: string | null;
    RetryCount: number;
    ConversationId: string | null;         // Preenchido após correlação
    MessageId: string | null;              // FK para Message criada

    CreatedAt: Date;
    ProcessedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Email Message Meta (Metadados de threading — tabela mais importante!)
// ---------------------------------------------------------------------------

/**
 * Cada mensagem de email (entrada ou saída) regista aqui os seus headers.
 * O motor de correlação consulta esta tabela para encontrar a conversa certa.
 * 
 * Exemplo de fluxo:
 * 1. Cliente envia email → Message-ID: <abc@gmail.com>
 * 2. Salvamos aqui: EmailMessageIdHeader = "<abc@gmail.com>", Direction = "IN"
 * 3. Agente responde → In-Reply-To: <abc@gmail.com>, Message-ID: <xyz@altdesk.com>
 * 4. Salvamos aqui: EmailMessageIdHeader = "<xyz@altdesk.com>", InReplyTo = "<abc@gmail.com>"
 * 5. Cliente responde de novo → In-Reply-To: <xyz@altdesk.com>
 * 6. Motor de correlação busca <xyz@altdesk.com> aqui → encontra ConversationId → THREADING ✅
 */
export interface EmailMessageMeta {
    Id: string;
    TenantId: string;
    ConversationId: string;
    MessageId: string | null;              // FK para altdesk.Message
    EmailChannelId: string | null;
    EmailMessageIdHeader: string;          // O Message-ID do header do email
    InReplyTo: string | null;
    ReferencesHeader: string | null;
    Direction: 'IN' | 'OUT';
    CreatedAt: Date;
}

// ---------------------------------------------------------------------------
// Raw Email Message (Mensagem bruta do provider, antes de normalizar)
// ---------------------------------------------------------------------------

/** Mensagem bruta retornada por um InboundEmailProvider (antes da normalização) */
export interface RawEmailMessage {
    uid: string;                           // UID IMAP da mensagem
    messageId: string | null;              // Header Message-ID
    inReplyTo: string | null;              // Header In-Reply-To
    references: string | null;             // Header References
    from: EmailAddress;
    to: EmailAddress[];
    cc: EmailAddress[];
    subject: string | null;
    textBody: string | null;
    htmlBody: string | null;
    date: Date | null;
    attachments: EmailAttachment[];
    rawHeaders: Record<string, string>;
}

/** Endereço de email estruturado */
export interface EmailAddress {
    address: string;                       // email@example.com
    name: string;                          // "João Silva"
}

/** Metadados de um anexo */
export interface EmailAttachment {
    filename: string;
    contentType: string;
    size: number;
    contentId?: string;                    // Para inline images
}

// ---------------------------------------------------------------------------
// Outbound Email Payload (Para enviar via provider)
// ---------------------------------------------------------------------------

/** Payload estruturado para envio de email via OutboundEmailProvider */
export interface OutboundEmailPayload {
    to: string;
    subject: string;
    html: string;
    text?: string;
    inReplyTo?: string;
    references?: string;
    fromName?: string;
    fromAddress?: string;
    replyTo?: string;
    attachments?: EmailAttachment[];
}

// ---------------------------------------------------------------------------
// Retry Queue
// ---------------------------------------------------------------------------

/** Registo na fila de retry */
export interface EmailRetryItem {
    RetryId: string;
    TenantId: string;
    EmailChannelId: string;
    ConversationId: string;
    ToAddress: string;
    Subject: string;
    BodyHtml: string;
    BodyText: string | null;
    InReplyTo: string | null;
    ReferencesHeader: string | null;
    AttachmentsJson: string | null;
    Status: RetryStatus;
    RetryCount: number;
    MaxRetries: number;
    NextRetryAt: Date;
    LastError: string | null;
    CreatedAt: Date;
    SentAt: Date | null;
}

// ---------------------------------------------------------------------------
// Email Channel com Settings (join para API responses)
// ---------------------------------------------------------------------------

/** Canal de email com as configurações de entrada e saída (para respostas da API) */
export interface EmailChannelWithSettings extends EmailChannel {
    inbound: EmailInboundSettings | null;
    outbound: EmailOutboundSettings | null;
}
