-- ============================================================
-- Migration 40: Add ResolutionDescription to altdesk.Ticket table
-- ============================================================
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Ticket') AND name = 'ResolutionDescription')
BEGIN
    ALTER TABLE altdesk.Ticket ADD ResolutionDescription NVARCHAR(MAX) NULL;
    PRINT 'Column ResolutionDescription added to altdesk.Ticket.';
END
ELSE
BEGIN
    PRINT 'Column ResolutionDescription already exists on altdesk.Ticket.';
END
GO
