USE AltDeskDev;
GO

-- Add PermissionsJson to User table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.[User]') AND name = 'PermissionsJson')
BEGIN
    ALTER TABLE altdesk.[User] ADD PermissionsJson NVARCHAR(MAX) NULL;
END
GO

-- Ensure Position exists (it should, but just in case)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.[User]') AND name = 'Position')
BEGIN
    ALTER TABLE altdesk.[User] ADD Position NVARCHAR(200) NULL;
END
ELSE
BEGIN
    -- Increase size if it was smaller
    ALTER TABLE altdesk.[User] ALTER COLUMN Position NVARCHAR(200) NULL;
END
GO
