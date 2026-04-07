-- Migration 12: Soft delete for conversations
-- Adds DeletedAt column to Conversation to allow soft deletion (hiding from UI while retaining data)

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.Conversation ADD DeletedAt DATETIME2 NULL;
END
GO
