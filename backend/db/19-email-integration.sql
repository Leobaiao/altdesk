-- ============================================================================
-- AltDesk Email Integration — Migration
-- Versão: 1.0 (MVP)
-- Descrição: Tabelas dedicadas para a integração de e-mail com polling IMAP,
--            threading por headers, e gestão de canais multi-empresa.
-- ============================================================================

SET QUOTED_IDENTIFIER ON;
GO

-- 1. EMAIL CHANNELS (Configuração principal de cada canal de e-mail)
-- Cada tenant pode ter múltiplos canais (ex: suporte@empresa.com, faturacao@empresa.com)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailChannel' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.EmailChannel (
        EmailChannelId   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId         UNIQUEIDENTIFIER NOT NULL,
        Name             NVARCHAR(200)    NOT NULL,  -- Nome amigável (ex: "Suporte Geral")
        EmailAddress     NVARCHAR(320)    NOT NULL,  -- suporte@empresa.com
        ProviderType     NVARCHAR(30)     NOT NULL DEFAULT 'imap_smtp',  -- imap_smtp | gmail | microsoft
        IsActive         BIT              NOT NULL DEFAULT 1,
        DefaultQueueId   UNIQUEIDENTIFIER NULL,      -- Fila padrão para tickets novos
        LastSyncAt       DATETIME2        NULL,      -- Último polling bem-sucedido
        LastError        NVARCHAR(MAX)    NULL,      -- Último erro de sync
        ConsecutiveFailureCount INT       NOT NULL DEFAULT 0,
        CreatedAt        DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt        DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        DeletedAt        DATETIME2        NULL,
        CONSTRAINT FK_EmailChannel_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_EmailChannel_Queue  FOREIGN KEY (DefaultQueueId) REFERENCES altdesk.Queue(QueueId)
    );

    CREATE INDEX IX_EmailChannel_Tenant_Active ON altdesk.EmailChannel(TenantId, IsActive) WHERE DeletedAt IS NULL;
    CREATE UNIQUE INDEX UQ_EmailChannel_Email ON altdesk.EmailChannel(TenantId, EmailAddress) WHERE DeletedAt IS NULL;
END
GO

-- 2. EMAIL INBOUND SETTINGS (Configuração de entrada — IMAP ou OAuth)
-- Separada da tabela principal para isolar segredos (passwords/tokens criptografados)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailInboundSettings' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.EmailInboundSettings (
        EmailChannelId      UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        Protocol            NVARCHAR(20)     NOT NULL DEFAULT 'IMAP',   -- IMAP | GMAIL_API | GRAPH_API
        ImapHost            NVARCHAR(255)    NULL,     -- ex: imap.gmail.com
        ImapPort            INT              NULL DEFAULT 993,
        ImapSecure          BIT              NULL DEFAULT 1,  -- TLS
        Username            NVARCHAR(320)    NULL,
        EncryptedPassword   NVARCHAR(MAX)    NULL,     -- AES-256 encrypted
        OAuthAccessToken    NVARCHAR(MAX)    NULL,     -- AES-256 encrypted
        OAuthRefreshToken   NVARCHAR(MAX)    NULL,     -- AES-256 encrypted
        OAuthExpiresAt      DATETIME2        NULL,
        LastProcessedUid    NVARCHAR(50)     NULL,     -- Último UID processado (para IMAP incremental)
        PollIntervalSeconds INT              NOT NULL DEFAULT 60,
        CONSTRAINT FK_InboundSettings_Channel FOREIGN KEY (EmailChannelId) REFERENCES altdesk.EmailChannel(EmailChannelId)
    );
END
GO

-- 3. EMAIL OUTBOUND SETTINGS (Configuração de saída — SMTP ou OAuth)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailOutboundSettings' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.EmailOutboundSettings (
        EmailChannelId      UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        Protocol            NVARCHAR(20)     NOT NULL DEFAULT 'SMTP',   -- SMTP | GMAIL_API | GRAPH_API
        SmtpHost            NVARCHAR(255)    NULL,     -- ex: smtp.gmail.com
        SmtpPort            INT              NULL DEFAULT 587,
        SmtpSecure          BIT              NULL DEFAULT 0,  -- false = STARTTLS, true = direct TLS
        Username            NVARCHAR(320)    NULL,
        EncryptedPassword   NVARCHAR(MAX)    NULL,     -- AES-256 encrypted
        OAuthAccessToken    NVARCHAR(MAX)    NULL,     -- AES-256 encrypted
        OAuthRefreshToken   NVARCHAR(MAX)    NULL,     -- AES-256 encrypted
        OAuthExpiresAt      DATETIME2        NULL,
        FromName            NVARCHAR(200)    NULL,     -- "Suporte EmpresaX"
        FromAddress         NVARCHAR(320)    NULL,     -- suporte@empresaX.com (pode diferir do EmailAddress)
        ReplyToAddress      NVARCHAR(320)    NULL,     -- Se diferente do FromAddress
        CONSTRAINT FK_OutboundSettings_Channel FOREIGN KEY (EmailChannelId) REFERENCES altdesk.EmailChannel(EmailChannelId)
    );
END
GO

-- 4. INBOUND EVENTS (Cada e-mail recebido — log de processamento)
-- Regra de negócio: cada e-mail recebido é registado aqui ANTES de ser processado.
-- O processing_status permite retry, debug e auditoria.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailInboundEvent' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.EmailInboundEvent (
        EventId             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        EmailChannelId      UNIQUEIDENTIFIER NOT NULL,
        TenantId            UNIQUEIDENTIFIER NOT NULL,

        -- Headers de threading (a chave para correlação)
        MessageIdHeader     NVARCHAR(500)    NULL,     -- Message-ID do email (ex: <abc123@gmail.com>)
        InReplyTo           NVARCHAR(500)    NULL,     -- In-Reply-To header
        ReferencesHeader    NVARCHAR(MAX)    NULL,     -- References header (lista de Message-IDs)

        -- Dados do email
        FromAddress         NVARCHAR(320)    NOT NULL,
        FromName            NVARCHAR(200)    NULL,
        ToAddress           NVARCHAR(320)    NOT NULL,
        Subject             NVARCHAR(500)    NULL,
        BodyText            NVARCHAR(MAX)    NULL,
        BodyHtml            NVARCHAR(MAX)    NULL,
        AttachmentsJson     NVARCHAR(MAX)    NULL,     -- JSON array: [{filename, contentType, size, url}]
        RawHeadersJson      NVARCHAR(MAX)    NULL,     -- Headers completos para debug

        -- Estado de processamento
        ProcessingStatus    NVARCHAR(20)     NOT NULL DEFAULT 'pending',
            -- pending | processing | processed | failed | duplicate
        ErrorMessage        NVARCHAR(MAX)    NULL,
        RetryCount          INT              NOT NULL DEFAULT 0,
        ConversationId      UNIQUEIDENTIFIER NULL,     -- Preenchido após correlação bem-sucedida
        MessageId           UNIQUEIDENTIFIER NULL,     -- FK para Message criada

        CreatedAt           DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        ProcessedAt         DATETIME2        NULL,

        CONSTRAINT FK_InboundEvent_Channel  FOREIGN KEY (EmailChannelId) REFERENCES altdesk.EmailChannel(EmailChannelId),
        CONSTRAINT FK_InboundEvent_Tenant   FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId)
    );

    CREATE INDEX IX_InboundEvent_Status ON altdesk.EmailInboundEvent(ProcessingStatus, CreatedAt);
    CREATE INDEX IX_InboundEvent_Channel ON altdesk.EmailInboundEvent(EmailChannelId, CreatedAt DESC);
    CREATE INDEX IX_InboundEvent_MessageId ON altdesk.EmailInboundEvent(MessageIdHeader) WHERE MessageIdHeader IS NOT NULL;
END
GO

-- 5. EMAIL MESSAGES (Metadados de threading — a tabela mais importante!)
-- Cada mensagem enviada OU recebida por email tem um registo aqui.
-- O motor de correlação consulta esta tabela para encontrar a conversa certa.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailMessageMeta' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.EmailMessageMeta (
        Id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId              UNIQUEIDENTIFIER NOT NULL,
        ConversationId        UNIQUEIDENTIFIER NOT NULL,
        MessageId             UNIQUEIDENTIFIER NULL,       -- FK para altdesk.Message (pode ser NULL para emails enviados antes do sistema)
        EmailChannelId        UNIQUEIDENTIFIER NULL,

        -- Headers de threading (o coração da correlação)
        EmailMessageIdHeader  NVARCHAR(500)    NOT NULL,   -- O Message-ID do email (único por email)
        InReplyTo             NVARCHAR(500)    NULL,
        ReferencesHeader      NVARCHAR(MAX)    NULL,

        Direction             NVARCHAR(5)      NOT NULL,   -- IN | OUT
        CreatedAt             DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_EmailMsgMeta_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_EmailMsgMeta_Conv   FOREIGN KEY (ConversationId) REFERENCES altdesk.Conversation(ConversationId),
        CONSTRAINT FK_EmailMsgMeta_Msg    FOREIGN KEY (MessageId) REFERENCES altdesk.Message(MessageId),
        CONSTRAINT FK_EmailMsgMeta_Chan   FOREIGN KEY (EmailChannelId) REFERENCES altdesk.EmailChannel(EmailChannelId)
    );

    -- Índice principal para correlação: buscar por Message-ID header
    CREATE INDEX IX_EmailMsgMeta_MsgIdHeader ON altdesk.EmailMessageMeta(EmailMessageIdHeader, TenantId);
    -- Índice para buscar por In-Reply-To (correlação nível 1)
    CREATE INDEX IX_EmailMsgMeta_InReplyTo ON altdesk.EmailMessageMeta(InReplyTo, TenantId) WHERE InReplyTo IS NOT NULL;
    -- Índice para buscar por conversa
    CREATE INDEX IX_EmailMsgMeta_Conv ON altdesk.EmailMessageMeta(ConversationId);
END
GO

-- 6. EMAIL RETRY QUEUE (Fila de reenvio para falhas de envio)
-- Regra de negócio do spec: "Falha de envio não pode descartar a resposta do agente"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailRetryQueue' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.EmailRetryQueue (
        RetryId             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId            UNIQUEIDENTIFIER NOT NULL,
        EmailChannelId      UNIQUEIDENTIFIER NOT NULL,
        ConversationId      UNIQUEIDENTIFIER NOT NULL,

        -- Dados do email a reenviar
        ToAddress           NVARCHAR(320)    NOT NULL,
        Subject             NVARCHAR(500)    NOT NULL,
        BodyHtml            NVARCHAR(MAX)    NOT NULL,
        BodyText            NVARCHAR(MAX)    NULL,
        InReplyTo           NVARCHAR(500)    NULL,
        ReferencesHeader    NVARCHAR(MAX)    NULL,
        AttachmentsJson     NVARCHAR(MAX)    NULL,

        -- Controle de retry
        Status              NVARCHAR(20)     NOT NULL DEFAULT 'pending',  -- pending | retrying | sent | failed_permanent
        RetryCount          INT              NOT NULL DEFAULT 0,
        MaxRetries          INT              NOT NULL DEFAULT 5,
        NextRetryAt         DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        LastError           NVARCHAR(MAX)    NULL,

        CreatedAt           DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        SentAt              DATETIME2        NULL,

        CONSTRAINT FK_RetryQueue_Tenant  FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_RetryQueue_Channel FOREIGN KEY (EmailChannelId) REFERENCES altdesk.EmailChannel(EmailChannelId),
        CONSTRAINT FK_RetryQueue_Conv    FOREIGN KEY (ConversationId) REFERENCES altdesk.Conversation(ConversationId)
    );

    CREATE INDEX IX_RetryQueue_Pending ON altdesk.EmailRetryQueue(Status, NextRetryAt) WHERE Status IN ('pending', 'retrying');
END
GO

PRINT '✅ Email Integration migration complete.';
GO
