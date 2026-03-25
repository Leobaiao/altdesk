-- Tabela de tokens para recuperação de senha
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PasswordResetToken' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.PasswordResetToken (
        TokenId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        UserId UNIQUEIDENTIFIER NOT NULL,
        Token NVARCHAR(200) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        UsedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_PRT_User FOREIGN KEY (UserId) REFERENCES altdesk.[User](UserId)
    );

    CREATE INDEX IX_PasswordResetToken_Token ON altdesk.PasswordResetToken(Token);
    CREATE INDEX IX_PasswordResetToken_User ON altdesk.PasswordResetToken(UserId);
END
GO
