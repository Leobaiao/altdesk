-- Migration 08: Trash System (Lixeira)
-- Adds DeletedAt column to Tenant and User tables to support soft-delete.

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.Tenant ADD DeletedAt DATETIME NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.[User]') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.[User] ADD DeletedAt DATETIME NULL;
END
GO
