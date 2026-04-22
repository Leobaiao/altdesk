-- Migration 17: Sync Soft Delete columns
-- Ensure that tables used by the CRM modules have the DeletedAt column to allow soft deletion.
-- This script uses ALTER TABLE to append the column if it doesn't already exist.

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.Contact ADD DeletedAt DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.CannedResponse') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.CannedResponse ADD DeletedAt DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.KnowledgeArticle') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.KnowledgeArticle ADD DeletedAt DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Template') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.Template ADD DeletedAt DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tag') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.Tag ADD DeletedAt DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Ticket') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.Ticket ADD DeletedAt DATETIME2 NULL;
END
GO
