USE master;
GO

IF EXISTS(SELECT * FROM sys.databases WHERE name = 'AltDeskDev')
BEGIN
    ALTER DATABASE AltDeskDev SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE AltDeskDev;
END
GO

CREATE DATABASE AltDeskDev;
GO

USE AltDeskDev;
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'altdesk')
BEGIN
    EXEC('CREATE SCHEMA altdesk');
END
GO

-- 1. Tenant
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tenant' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Tenant (
        TenantId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        Name NVARCHAR(100) NOT NULL,
        DefaultProvider NVARCHAR(50) NOT NULL DEFAULT 'GTI',
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 2. Subscription
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Subscription' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Subscription (
        SubscriptionId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        IsActive BIT DEFAULT 1,
        AgentsSeatLimit INT DEFAULT 5,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 3. Role
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Role' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Role (
        RoleId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        Name NVARCHAR(100) NOT NULL,
        CanOpen BIT NOT NULL DEFAULT 1,
        CanEscalate BIT NOT NULL DEFAULT 0,
        CanClose BIT NOT NULL DEFAULT 0,
        CanComment BIT NOT NULL DEFAULT 1,
        HourlyValue DECIMAL(10,2) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UK_Role_Name UNIQUE (TenantId, Name)
    );
END
GO

-- 4. User
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'User' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.[User] (
        UserId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        Email NVARCHAR(255) NOT NULL,
        PasswordHash VARBINARY(MAX) NOT NULL,
        Role NVARCHAR(50) NOT NULL DEFAULT 'AGENT', -- ADMIN, AGENT, SUPERADMIN
        Name NVARCHAR(100) NULL,
        DisplayName NVARCHAR(255) NULL,
        CPF NVARCHAR(14) NULL,
        Avatar NVARCHAR(MAX) NULL,
        Position NVARCHAR(100) NULL,
        RoleId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.Role(RoleId),
        HasLogAccess BIT NOT NULL DEFAULT 0,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UK_User_Email UNIQUE (Email)
    );
END
GO

-- 5. Agent
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Agent' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Agent (
        AgentId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        UserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.[User](UserId),
        Kind NVARCHAR(50) NOT NULL, -- HUMAN, BOT
        Name NVARCHAR(100) NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 6. Channel
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Channel' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Channel (
        ChannelId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        Name NVARCHAR(100) NOT NULL,
        Type NVARCHAR(50) NOT NULL DEFAULT 'MESSAGING',
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 7. ChannelConnector
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChannelConnector' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.ChannelConnector (
        ConnectorId NVARCHAR(100) PRIMARY KEY,
        ChannelId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Channel(ChannelId),
        Provider NVARCHAR(50) NOT NULL, -- GTI, OFFICIAL
        ConfigJson NVARCHAR(MAX) NULL,
        WebhookSecret NVARCHAR(100) NULL,
        IsActive BIT DEFAULT 1,
        DeletedAt DATETIME2 NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 8. Queue
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Queue' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Queue (
        QueueId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        Name NVARCHAR(100) NOT NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 9. Conversation
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Conversation' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Conversation (
        ConversationId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        ChannelId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Channel(ChannelId),
        QueueId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.Queue(QueueId),
        AssignedUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.[User](UserId),
        OpenedByUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.[User](UserId),
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

-- 10. ExternalThreadMap
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ExternalThreadMap' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.ExternalThreadMap (
        MapId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        ConnectorId NVARCHAR(100) NOT NULL FOREIGN KEY REFERENCES altdesk.ChannelConnector(ConnectorId),
        ExternalChatId NVARCHAR(255) NOT NULL,
        ExternalUserId NVARCHAR(255) NOT NULL,
        ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Conversation(ConversationId),
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UK_ExternalMap UNIQUE (ConnectorId, ExternalChatId)
    );
END
GO

-- 11. Message
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Message' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Message (
        MessageId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Conversation(ConversationId),
        Direction NVARCHAR(10) NOT NULL, -- IN, OUT, INTERNAL
        SenderExternalId NVARCHAR(255) NULL,
        Body NVARCHAR(MAX) NULL,
        MediaType NVARCHAR(50) NULL, -- image, audio, video, document
        MediaUrl NVARCHAR(MAX) NULL,
        ExternalMessageId NVARCHAR(255) NULL,
        PayloadJson NVARCHAR(MAX) NULL,
        Status VARCHAR(20) DEFAULT 'SENT', -- SENT, DELIVERED, READ, FAILED
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 12. CannedResponse
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CannedResponse' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.CannedResponse (
        CannedResponseId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        Shortcut NVARCHAR(50) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Title NVARCHAR(100) NOT NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UK_CannedResponse_Shortcut UNIQUE (TenantId, Shortcut)
    );
END
GO

-- 13. Contact
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Contact' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Contact (
        ContactId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        Name NVARCHAR(100) NOT NULL,
        Phone NVARCHAR(50) NOT NULL,
        CPF NVARCHAR(14) NULL,
        Email NVARCHAR(255) NULL,
        Tags NVARCHAR(MAX) NULL, -- JSON array
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 14. Template
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Template' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Template (
        TemplateId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        Name NVARCHAR(100) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Variables NVARCHAR(MAX) NULL, -- JSON array
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 15. ConversationHistory
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ConversationHistory' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.ConversationHistory (
        HistoryId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Conversation(ConversationId),
        SequenceNumber INT NOT NULL,
        Action NVARCHAR(50) NOT NULL, -- OPENED, REPLIED, etc.
        ActorUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.[User](UserId),
        EscalatedToUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.[User](UserId),
        MetadataJson NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 16. AuditLog
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLog' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.AuditLog (
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
