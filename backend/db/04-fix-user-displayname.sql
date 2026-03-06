-- Fix: Add DisplayName column to User table which was missing
USE OmniChatDev;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('omni.[User]') AND name = 'DisplayName')
BEGIN
    ALTER TABLE omni.[User] ADD DisplayName NVARCHAR(255) NULL;
END
GO

PRINT 'DisplayName column added to omni.[User]';
GO
