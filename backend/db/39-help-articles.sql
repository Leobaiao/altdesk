-- ============================================================
-- Migration 39: altdesk.HelpArticle
-- Sistema de Ajuda Contextual Dinâmica (Help Sliding Window)
-- ============================================================
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HelpArticle' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.HelpArticle (
        HelpArticleId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        ContextKey NVARCHAR(120) NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Category NVARCHAR(100) NULL,
        PagePath NVARCHAR(200) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        DeletedAt DATETIME2 NULL
    );
    PRINT 'Table altdesk.HelpArticle created.';
END
ELSE
BEGIN
    PRINT 'Table altdesk.HelpArticle already exists.';
END
GO

-- Unique index for tenant-specific articles
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UK_HelpArticle_Tenant_ContextKey' AND object_id = OBJECT_ID('altdesk.HelpArticle'))
BEGIN
    CREATE UNIQUE INDEX UK_HelpArticle_Tenant_ContextKey 
    ON altdesk.HelpArticle(TenantId, ContextKey) 
    WHERE TenantId IS NOT NULL AND DeletedAt IS NULL;
    PRINT 'Index UK_HelpArticle_Tenant_ContextKey created.';
END
GO

-- Unique index for global articles (TenantId IS NULL)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UK_HelpArticle_Global_ContextKey' AND object_id = OBJECT_ID('altdesk.HelpArticle'))
BEGIN
    CREATE UNIQUE INDEX UK_HelpArticle_Global_ContextKey 
    ON altdesk.HelpArticle(ContextKey) 
    WHERE TenantId IS NULL AND DeletedAt IS NULL;
    PRINT 'Index UK_HelpArticle_Global_ContextKey created.';
END
GO

PRINT 'Migration 39 (help-articles) completed.';
GO
