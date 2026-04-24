-- ============================================================================
-- Migration 20: Add ContextData column to Conversation table
-- Required by email integration for storing email subject threading data
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'ContextData'
)
BEGIN
    ALTER TABLE altdesk.Conversation ADD ContextData NVARCHAR(MAX) NULL;
    PRINT '✅ Added ContextData column to altdesk.Conversation';
END
ELSE
BEGIN
    PRINT '⏭️ ContextData column already exists, skipping.';
END
GO
