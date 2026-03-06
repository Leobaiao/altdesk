-- SQL Server 2019/Express compatible
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'altdesk')
    EXEC('CREATE SCHEMA altdesk');
GO

CREATE TABLE altdesk.Tenant (
    TenantId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsActive BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE altdesk.Subscription (
    SubscriptionId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    PlanCode NVARCHAR(50) NOT NULL,
    AgentsSeatLimit INT NOT NULL,
    StartsAt DATETIME2 NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Subscription_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId)
);
GO
CREATE INDEX IX_Subscription_Tenant_Active ON altdesk.Subscription(TenantId, IsActive, ExpiresAt);
GO

CREATE TABLE altdesk.[User] (
    UserId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    Email NVARCHAR(320) NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL,
    PasswordHash VARBINARY(256) NOT NULL,
    Role NVARCHAR(50) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    LastLoginAt DATETIME2 NULL,
    CONSTRAINT UQ_User_Tenant_Email UNIQUE (TenantId, Email),
    CONSTRAINT FK_User_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId)
);
GO
CREATE INDEX IX_User_Tenant_Role ON altdesk.[User](TenantId, Role, IsActive);
GO

CREATE TABLE altdesk.Agent (
    AgentId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NULL,
    Kind NVARCHAR(20) NOT NULL, -- HUMAN, BOT
    Name NVARCHAR(200) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Agent_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
    CONSTRAINT FK_Agent_User FOREIGN KEY (UserId) REFERENCES altdesk.[User](UserId)
);
GO
CREATE INDEX IX_Agent_Tenant_Active ON altdesk.Agent(TenantId, IsActive, Kind);
GO

CREATE TABLE altdesk.Channel (
    ChannelId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    Type NVARCHAR(50) NOT NULL, -- WHATSAPP, WEBCHAT, etc.
    Name NVARCHAR(200) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Channel_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId)
);
GO

CREATE TABLE altdesk.ChannelConnector (
    ConnectorId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    ChannelId UNIQUEIDENTIFIER NOT NULL,
    Provider NVARCHAR(30) NOT NULL DEFAULT 'GENERIC', -- GTI | ZAPI | OFFICIAL
    RoutingKey NVARCHAR(100) NULL,
    ConfigJson NVARCHAR(MAX) NOT NULL,
    WebhookSecret NVARCHAR(200) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Connector_Channel FOREIGN KEY (ChannelId) REFERENCES altdesk.Channel(ChannelId)
);
GO

CREATE TABLE altdesk.Conversation (
    ConversationId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ChannelId UNIQUEIDENTIFIER NULL,
    Title NVARCHAR(200) NOT NULL,
    Kind NVARCHAR(20) NOT NULL, -- GROUP, DIRECT, TICKET
    Status NVARCHAR(20) NOT NULL DEFAULT 'OPEN',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    LastMessageAt DATETIME2 NULL,
    CONSTRAINT FK_Conversation_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
    CONSTRAINT FK_Conversation_Channel FOREIGN KEY (ChannelId) REFERENCES altdesk.Channel(ChannelId)
);
GO
CREATE INDEX IX_Conversation_Tenant_LastMessage ON altdesk.Conversation(TenantId, LastMessageAt DESC);
GO

CREATE TABLE altdesk.ConversationMember (
    ConversationId UNIQUEIDENTIFIER NOT NULL,
    AgentId UNIQUEIDENTIFIER NOT NULL,
    Role NVARCHAR(50) NOT NULL,
    JoinedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (ConversationId, AgentId),
    CONSTRAINT FK_ConvMember_Conversation FOREIGN KEY (ConversationId) REFERENCES altdesk.Conversation(ConversationId),
    CONSTRAINT FK_ConvMember_Agent FOREIGN KEY (AgentId) REFERENCES altdesk.Agent(AgentId)
);
GO

CREATE TABLE altdesk.Message (
    MessageId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ConversationId UNIQUEIDENTIFIER NOT NULL,
    SenderAgentId UNIQUEIDENTIFIER NULL,
    SenderExternalId NVARCHAR(200) NULL,
    Direction NVARCHAR(10) NOT NULL, -- IN, OUT, INTERNAL
    Body NVARCHAR(MAX) NOT NULL,
    PayloadJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Message_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
    CONSTRAINT FK_Message_Conversation FOREIGN KEY (ConversationId) REFERENCES altdesk.Conversation(ConversationId),
    CONSTRAINT FK_Message_SenderAgent FOREIGN KEY (SenderAgentId) REFERENCES altdesk.Agent(AgentId)
);
GO
CREATE INDEX IX_Message_Conversation_Time ON altdesk.Message(ConversationId, CreatedAt DESC);
GO

CREATE TABLE altdesk.Ticket (
    TicketId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ConversationId UNIQUEIDENTIFIER NOT NULL,
    Priority NVARCHAR(20) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'OPEN',
    AssignedAgentId UNIQUEIDENTIFIER NULL,
    EscalationLevel INT NOT NULL DEFAULT 0,
    SLA_DueAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Ticket_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
    CONSTRAINT FK_Ticket_Conversation FOREIGN KEY (ConversationId) REFERENCES altdesk.Conversation(ConversationId),
    CONSTRAINT FK_Ticket_AssignedAgent FOREIGN KEY (AssignedAgentId) REFERENCES altdesk.Agent(AgentId)
);
GO
CREATE INDEX IX_Ticket_Tenant_Status ON altdesk.Ticket(TenantId, Status, Priority);
GO

CREATE TABLE altdesk.LLMUsage (
    UsageId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NULL,
    ConversationId UNIQUEIDENTIFIER NULL,
    Provider NVARCHAR(50) NOT NULL,
    Model NVARCHAR(100) NOT NULL,
    PromptTokens INT NOT NULL DEFAULT 0,
    CompletionTokens INT NOT NULL DEFAULT 0,
    TotalTokens INT NOT NULL DEFAULT 0,
    CostUSD DECIMAL(18,6) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_LLMUsage_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
    CONSTRAINT FK_LLMUsage_User FOREIGN KEY (UserId) REFERENCES altdesk.[User](UserId),
    CONSTRAINT FK_LLMUsage_Conversation FOREIGN KEY (ConversationId) REFERENCES altdesk.Conversation(ConversationId)
);
GO

CREATE TABLE altdesk.ExternalThreadMap (
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ConnectorId UNIQUEIDENTIFIER NOT NULL,
    ExternalChatId NVARCHAR(200) NOT NULL,
    ExternalUserId NVARCHAR(200) NOT NULL,
    ConversationId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (TenantId, ConnectorId, ExternalChatId),
    CONSTRAINT FK_ETM_Conversation FOREIGN KEY (ConversationId) REFERENCES altdesk.Conversation(ConversationId)
);
GO
CREATE INDEX IX_ETM_User ON altdesk.ExternalThreadMap(TenantId, ConnectorId, ExternalUserId);
GO
