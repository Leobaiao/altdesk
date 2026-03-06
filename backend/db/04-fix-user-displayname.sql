-- Fix: Add DisplayName column to User table which was missing
USE AltDeskDev;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.[User]') AND name = 'DisplayName')
BEGIN
    ALTER TABLE altdesk.[User] ADD DisplayName NVARCHAR(255) NULL;
END
GO

PRINT 'DisplayName column added to altdesk.[User]';
GO
