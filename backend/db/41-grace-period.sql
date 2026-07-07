USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- Add GraceExpiresAt and GraceCount to Subscription table
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('altdesk.Subscription') AND name = 'GraceExpiresAt'
)
BEGIN
    ALTER TABLE altdesk.Subscription ADD GraceExpiresAt DATETIME2 NULL;
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('altdesk.Subscription') AND name = 'GraceCount'
)
BEGIN
    ALTER TABLE altdesk.Subscription ADD GraceCount INT DEFAULT 0;
END
GO
