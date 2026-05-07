-- Add SenderUserId to Message table
IF NOT EXISTS (
    SELECT * 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID('altdesk.Message') 
      AND name = 'SenderUserId'
)
BEGIN
    ALTER TABLE altdesk.Message ADD SenderUserId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.[User](UserId);
END
GO
