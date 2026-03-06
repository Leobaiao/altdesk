-- ============================================================
-- Migration: Roles, CPF, Audit Log, ConversationHistory
-- Run this on an existing OmniChatDev database.
-- ============================================================

USE OmniChatDev;
GO

-- ----------------------------------------
-- 1. omni.Role – tabela de funções
-- ----------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Role' AND schema_id = SCHEMA_ID('omni'))
BEGIN
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
END
GO

-- ----------------------------------------
-- 2. omni.[User] – novos campos CPF, RoleId, HasLogAccess
-- ----------------------------------------
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.[User]') AND name = 'CPF')
BEGIN
    ALTER TABLE omni.[User] ADD CPF NVARCHAR(14) NULL; -- formato 000.000.000-00 ou 00000000000
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.[User]') AND name = 'RoleId')
BEGIN
    ALTER TABLE omni.[User] ADD RoleId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.Role(RoleId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.[User]') AND name = 'HasLogAccess')
BEGIN
    ALTER TABLE omni.[User] ADD HasLogAccess BIT NOT NULL DEFAULT 0;
END
GO

-- Índice único para CPF por tenant (somente quando CPF não é NULL)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_User_CPF_Tenant')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_User_CPF_Tenant
        ON omni.[User](TenantId, CPF)
        WHERE CPF IS NOT NULL;
END
GO

-- ----------------------------------------
-- 3. omni.Contact – campo CPF
-- ----------------------------------------
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.Contact') AND name = 'CPF')
BEGIN
    ALTER TABLE omni.Contact ADD CPF NVARCHAR(14) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_Contact_CPF_Tenant')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Contact_CPF_Tenant
        ON omni.Contact(TenantId, CPF)
        WHERE CPF IS NOT NULL;
END
GO

-- ----------------------------------------
-- 4. omni.Conversation – campo InteractionSequence
-- ----------------------------------------
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.Conversation') AND name = 'InteractionSequence')
BEGIN
    ALTER TABLE omni.Conversation ADD InteractionSequence INT NOT NULL DEFAULT 0;
END
GO

-- Campos extras para rastrear quem abriu e quem está atendendo
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.Conversation') AND name = 'OpenedByUserId')
BEGIN
    ALTER TABLE omni.Conversation ADD OpenedByUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.[User](UserId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.Conversation') AND name = 'OpenedByContactId')
BEGIN
    ALTER TABLE omni.Conversation ADD OpenedByContactId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES omni.Contact(ContactId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.Conversation') AND name = 'SourceChannel')
BEGIN
    ALTER TABLE omni.Conversation ADD SourceChannel NVARCHAR(50) NULL; -- WHATSAPP, PLATFORM, CHATBOT, EMAIL, RCS, SMS
END
GO

-- ----------------------------------------
-- 5. omni.ConversationHistory – histórico de interações
-- ----------------------------------------
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
        MetadataJson NVARCHAR(MAX) NULL, -- detalhes extras, ex: {"previousStatus":"OPEN","newStatus":"RESOLVED"}
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Índice para busca rápida por conversa
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConversationHistory_ConvId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ConversationHistory_ConvId
        ON omni.ConversationHistory(ConversationId, SequenceNumber);
END
GO

-- ----------------------------------------
-- 6. omni.AuditLog – log de auditoria geral
-- ----------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLog' AND schema_id = SCHEMA_ID('omni'))
BEGIN
    CREATE TABLE omni.AuditLog (
        LogId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NULL,
        UserId UNIQUEIDENTIFIER NULL,
        Action NVARCHAR(100) NOT NULL, -- CREATE_USER, UPDATE_USER, DELETE_CONVERSATION, etc.
        TargetTable NVARCHAR(100) NULL,
        TargetId NVARCHAR(255) NULL,
        BeforeValues NVARCHAR(MAX) NULL, -- JSON snapshot antes da ação
        AfterValues NVARCHAR(MAX) NULL,  -- JSON snapshot depois da ação
        IpAddress NVARCHAR(45) NULL,
        UserAgent NVARCHAR(500) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Índice para busca por tenant e data
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLog_Tenant_Date')
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLog_Tenant_Date
        ON omni.AuditLog(TenantId, CreatedAt DESC);
END
GO

PRINT '=== Migration completed successfully ===';
GO
