USE master;
GO

IF EXISTS(SELECT * FROM sys.databases WHERE name = 'OmniChatDev')
BEGIN
    ALTER DATABASE OmniChatDev SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE OmniChatDev;
END
GO

CREATE DATABASE OmniChatDev;
GO

USE OmniChatDev;
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'omni')
BEGIN
    EXEC('CREATE SCHEMA omni');
END
GO

CREATE TABLE omni.Tenant (
    TenantId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    DefaultProvider NVARCHAR(50) NOT NULL DEFAULT 'GTI',
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE omni.Subscription (
    SubscriptionId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
    IsActive BIT DEFAULT 1,
    AgentsSeatLimit INT DEFAULT 5,
    ExpiresAt DATETIME2 NOT NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE omni.Role (
    RoleId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
    Name NVARCHAR(100) NOT NULL,
    CanOpen BIT NOT NULL DEFAULT 1,
    CanEscalate BIT NOT NULL DEFAULT 0,
    CanClose BIT NOT NULL DEFAULT 0,
    CanComment BIT NOT NULL DEFAULT 1,
    HourlyValue DECIMAL(10,2) NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UK_Role_Name UNIQUE (TenantId, Name)
);
GO

CREATE TABLE omni.[User] (
    UserId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
    Email NVARCHAR(255) NOT NULL,
    PasswordHash VARBINARY(MAX) NOT NULL,
    Role NVARCHAR(50) NOT NULL DEFAULT 'AGENT', -- ADMIN, AGENT
    CPF NVARCHAR(14) NULL,
    RoleId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.Role(RoleId),
    HasLogAccess BIT NOT NULL DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UK_User_Email UNIQUE (Email)
);
GO

CREATE TABLE omni.Agent (
    AgentId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
    UserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.[User](UserId),
    Kind NVARCHAR(50) NOT NULL, -- HUMAN, BOT
    Name NVARCHAR(100) NOT NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE omni.Channel (
    ChannelId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
    Name NVARCHAR(100) NOT NULL,
    Type NVARCHAR(50) NOT NULL DEFAULT 'MESSAGING', -- MESSAGING, VOICE, ETC
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE omni.ChannelConnector (
    ConnectorId NVARCHAR(100) PRIMARY KEY, -- ex: "whatsapp-gti-01"
    ChannelId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Channel(ChannelId),
    Provider NVARCHAR(50) NOT NULL, -- GTI, OFFICIAL
    ConfigJson NVARCHAR(MAX) NULL,
    WebhookSecret NVARCHAR(100) NULL,
    IsActive BIT DEFAULT 1,
    DeletedAt DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

-- Queue
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Queue' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.Queue (
        QueueId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        Name NVARCHAR(100) NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Conversation
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Conversation' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.Conversation (
        ConversationId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        ChannelId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Channel(ChannelId),
        QueueId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.Queue(QueueId),
        AssignedUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.[User](UserId),
        OpenedByUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.[User](UserId),
        OpenedByContactId UNIQUEIDENTIFIER NULL,
        Title NVARCHAR(255) NULL,
        Kind NVARCHAR(50) NOT NULL DEFAULT 'DIRECT', -- DIRECT, GROUP
        Status NVARCHAR(50) NOT NULL DEFAULT 'OPEN', -- OPEN, RESOLVED, SNOOZED
        SourceChannel NVARCHAR(50) NULL, -- WHATSAPP, PLATFORM, CHATBOT, EMAIL, RCS, SMS
        InteractionSequence INT NOT NULL DEFAULT 0,
        LastMessageAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

CREATE TABLE omni.ExternalThreadMap (
    MapId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
    ConnectorId NVARCHAR(100) NOT NULL FOREIGN KEY REFERENCES omni.ChannelConnector(ConnectorId),
    ExternalChatId NVARCHAR(255) NOT NULL, -- O ID do chat lá fora
    ExternalUserId NVARCHAR(255) NOT NULL, -- Quem iniciou (se direct, igual ao chatid)
    ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Conversation(ConversationId),
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UK_ExternalMap UNIQUE (ConnectorId, ExternalChatId)
);
GO

CREATE TABLE omni.Message (
    MessageId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
    ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Conversation(ConversationId),
    Direction NVARCHAR(10) NOT NULL, -- IN, OUT, INTERNAL
    SenderExternalId NVARCHAR(255) NULL, -- se IN
    Body NVARCHAR(MAX) NULL,
    MediaType NVARCHAR(50) NULL, -- image, audio, video, document
    MediaUrl NVARCHAR(MAX) NULL,
    PayloadJson NVARCHAR(MAX) NULL, -- raw payload do provider
    Status VARCHAR(20) DEFAULT 'SENT', -- SENT, DELIVERED, READ, FAILED
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

-- Tenant
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tenant' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.Tenant (
        TenantId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        Name NVARCHAR(100) NOT NULL,
        DefaultProvider NVARCHAR(50) NOT NULL DEFAULT 'GTI',
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Subscription
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Subscription' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.Subscription (
        SubscriptionId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        IsActive BIT DEFAULT 1,
        AgentsSeatLimit INT DEFAULT 5,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- User
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'User' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.[User] (
        UserId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        Email NVARCHAR(255) NOT NULL,
        PasswordHash VARBINARY(MAX) NOT NULL,
        Role NVARCHAR(50) NOT NULL DEFAULT 'AGENT', -- ADMIN, AGENT
        Name NVARCHAR(100) NULL,
        Avatar NVARCHAR(MAX) NULL,
        Position NVARCHAR(100) NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UK_User_Email UNIQUE (Email)
    );
END
GO

-- PROVISÓRIO: Agent table (mencionado no código para verificar assentos)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Agent' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.Agent (
        AgentId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        UserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.[User](UserId),
        Kind NVARCHAR(50) NOT NULL, -- HUMAN, BOT
        Name NVARCHAR(100) NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Channel
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Channel' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.Channel (
        ChannelId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        Name NVARCHAR(100) NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- ChannelConnector
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChannelConnector' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.ChannelConnector (
        ConnectorId NVARCHAR(100) PRIMARY KEY, -- ex: "whatsapp-gti-01"
        ChannelId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Channel(ChannelId),
        Provider NVARCHAR(50) NOT NULL, -- GTI, OFFICIAL
        ConfigJson NVARCHAR(MAX) NULL,
        WebhookSecret NVARCHAR(100) NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- ExternalThreadMap (mapeia chat externo -> conversation interna)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ExternalThreadMap' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.ExternalThreadMap (
        MapId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        ConnectorId NVARCHAR(100) NOT NULL FOREIGN KEY REFERENCES omni.ChannelConnector(ConnectorId),
        ExternalChatId NVARCHAR(255) NOT NULL, -- O ID do chat lá fora
        ExternalUserId NVARCHAR(255) NOT NULL, -- Quem iniciou (se direct, igual ao chatid)
        ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Conversation(ConversationId),
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UK_ExternalMap UNIQUE (ConnectorId, ExternalChatId)
    );
END
GO

-- Message
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Message' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.Message (
        MessageId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Conversation(ConversationId),
        Direction NVARCHAR(10) NOT NULL, -- IN, OUT, INTERNAL
        SenderExternalId NVARCHAR(255) NULL, -- se IN
        Body NVARCHAR(MAX) NULL,
        MediaType NVARCHAR(50) NULL, -- image, audio, video, document
        MediaUrl NVARCHAR(MAX) NULL,
        PayloadJson NVARCHAR(MAX) NULL, -- raw payload do provider
        Status VARCHAR(20) DEFAULT 'SENT', -- SENT, DELIVERED, READ, FAILED
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- CannedResponse
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CannedResponse' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.CannedResponse (
        CannedResponseId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        Shortcut NVARCHAR(50) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Title NVARCHAR(100) NOT NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UK_CannedResponse_Shortcut UNIQUE (TenantId, Shortcut)
    );
END

-- Contact
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Contact' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.Contact (
        ContactId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        Name NVARCHAR(100) NOT NULL,
        Phone NVARCHAR(50) NOT NULL,
        CPF NVARCHAR(14) NULL,
        Email NVARCHAR(255) NULL,
        Tags NVARCHAR(MAX) NULL, -- JSON array e.g. ["vip", "lead"]
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Template (WhatsApp HSM)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Template' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.Template (
        TemplateId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        Name NVARCHAR(100) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Variables NVARCHAR(MAX) NULL, -- JSON array e.g. ["name", "orderId"]
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- ConversationHistory
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ConversationHistory' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.ConversationHistory (
        HistoryId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Tenant(TenantId),
        ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES omni.Conversation(ConversationId),
        SequenceNumber INT NOT NULL,
        Action NVARCHAR(50) NOT NULL, -- OPENED, REPLIED, ESCALATED, CLOSED, COMMENTED, ASSIGNED, STATUS_CHANGED
        ActorUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.[User](UserId),
        EscalatedToUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.[User](UserId),
        MetadataJson NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- AuditLog
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLog' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.AuditLog (
        LogId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NULL,
        UserId UNIQUEIDENTIFIER NULL,
        Action NVARCHAR(100) NOT NULL,
        TargetTable NVARCHAR(100) NULL,
        TargetId NVARCHAR(255) NULL,
        BeforeValues NVARCHAR(MAX) NULL,
        AfterValues NVARCHAR(MAX) NULL,
        IpAddress NVARCHAR(45) NULL,
        UserAgent NVARCHAR(500) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO
