-- ============================================================
-- Migration 15: Consolidated missing feature fields
-- Ports TS-only migrations to official SQL pipeline:
--   SLA, CSAT, Business Hours, Knowledge Base, Tags, Metrics,
--   DefaultProvider, DeletedAt
-- Safe to re-run (all operations are idempotent).
-- ============================================================

USE AltDeskDev;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ─────────────────────────────────────────────────────────────
-- 1. SLA fields on Conversation
-- ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'SlaDeadline')
    ALTER TABLE altdesk.Conversation ADD SlaDeadline DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'FirstResponseAt')
    ALTER TABLE altdesk.Conversation ADD FirstResponseAt DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'SlaStatus')
    ALTER TABLE altdesk.Conversation ADD SlaStatus NVARCHAR(20) NULL;
GO

-- ─────────────────────────────────────────────────────────────
-- 2. Metrics – ClosedAt on Conversation
-- ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'ClosedAt')
    ALTER TABLE altdesk.Conversation ADD ClosedAt DATETIME NULL;
GO

-- Backfill ClosedAt for existing RESOLVED conversations
UPDATE altdesk.Conversation
SET ClosedAt = ISNULL(LastMessageAt, CreatedAt)
WHERE Status = 'RESOLVED' AND ClosedAt IS NULL;
GO

-- ─────────────────────────────────────────────────────────────
-- 3. CSAT – SatisfactionRating table + fields
-- ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('altdesk.SatisfactionRating') AND type = 'U')
BEGIN
    CREATE TABLE altdesk.SatisfactionRating (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ConversationId UNIQUEIDENTIFIER NOT NULL REFERENCES altdesk.Conversation(ConversationId),
        Score INT NOT NULL CHECK (Score BETWEEN 1 AND 5),
        Comment NVARCHAR(1000) NULL,
        CreatedAt DATETIME DEFAULT GETUTCDATE()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'CsatScore')
    ALTER TABLE altdesk.Conversation ADD CsatScore INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'EnableCsat')
    ALTER TABLE altdesk.Tenant ADD EnableCsat BIT NOT NULL DEFAULT 0;
GO

-- ─────────────────────────────────────────────────────────────
-- 4. Business Hours
-- ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('altdesk.BusinessHours') AND type = 'U')
BEGIN
    CREATE TABLE altdesk.BusinessHours (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TenantId UNIQUEIDENTIFIER NOT NULL REFERENCES altdesk.Tenant(TenantId),
        DayOfWeek INT NOT NULL CHECK (DayOfWeek BETWEEN 0 AND 6),
        StartTime TIME NOT NULL DEFAULT '08:00',
        EndTime TIME NOT NULL DEFAULT '18:00',
        IsActive BIT NOT NULL DEFAULT 1,
        UNIQUE (TenantId, DayOfWeek)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'OffHoursMessage')
    ALTER TABLE altdesk.Tenant ADD OffHoursMessage NVARCHAR(500) NULL;
GO

-- ─────────────────────────────────────────────────────────────
-- 5. Knowledge Base
-- ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'KnowledgeArticle' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.KnowledgeArticle (
        ArticleId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        Title NVARCHAR(200) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Category NVARCHAR(50) NULL,
        IsPublic BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- ─────────────────────────────────────────────────────────────
-- 6. Tags
-- ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tag' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Tag (
        TagId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        Name NVARCHAR(50) NOT NULL,
        Color NVARCHAR(20) NOT NULL DEFAULT '#E2E8F0',
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UK_Tag_Name UNIQUE (TenantId, Name)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ConversationTag' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.ConversationTag (
        ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Conversation(ConversationId),
        TagId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tag(TagId),
        PRIMARY KEY (ConversationId, TagId)
    );
END
GO

-- ─────────────────────────────────────────────────────────────
-- 7. DefaultProvider on Tenant
-- ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'DefaultProvider')
    ALTER TABLE altdesk.Tenant ADD DefaultProvider NVARCHAR(50) DEFAULT 'GTI';
GO

-- ─────────────────────────────────────────────────────────────
-- 8. DeletedAt on ChannelConnector
-- ─────────────────────────────────────────────────────────────
IF COL_LENGTH('altdesk.ChannelConnector', 'DeletedAt') IS NULL
    ALTER TABLE altdesk.ChannelConnector ADD DeletedAt DATETIME2 NULL;
GO

PRINT 'Migration 15 (Missing Features Fields) concluida com sucesso.';
GO
