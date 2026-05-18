USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ──────────────────────────────────────────────────────────────
-- Migration 37: Rastreabilidade de Contatos (CRM)
-- Garante a existência dos campos de Source, ChannelType, Campaign e LastActivityAt
-- ──────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'Source')
BEGIN
    ALTER TABLE altdesk.Contact ADD [Source] NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'ChannelType')
BEGIN
    ALTER TABLE altdesk.Contact ADD [ChannelType] NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'Campaign')
BEGIN
    ALTER TABLE altdesk.Contact ADD [Campaign] NVARCHAR(500) NULL;
END
ELSE
BEGIN
    -- Se já existe mas for curto (255), aumenta para 500 para suportar UTMs longas
    IF (SELECT max_length FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'Campaign') < 500
    BEGIN
        ALTER TABLE altdesk.Contact ALTER COLUMN [Campaign] NVARCHAR(500) NULL;
    END
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'LastActivityAt')
BEGIN
    ALTER TABLE altdesk.Contact ADD [LastActivityAt] DATETIME2(7) NULL;
END
GO

-- Index para performance em listagens por atividade
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Contact_LastActivityAt' AND object_id = OBJECT_ID('altdesk.Contact'))
BEGIN
    CREATE INDEX IX_Contact_LastActivityAt ON altdesk.Contact(TenantId, LastActivityAt DESC);
END
GO
