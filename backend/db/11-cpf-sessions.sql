-- Migration 11: CPF Session persistence (replaces in-memory Map)
-- Stores CPF validation flow state in the database for resilience across restarts.

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'altdesk' AND TABLE_NAME = 'CpfSession')
BEGIN
    CREATE TABLE altdesk.CpfSession (
        ExternalUserId NVARCHAR(100) NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Step NVARCHAR(20) NOT NULL DEFAULT 'AWAITING_CPF',
        PartialDataJson NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_CpfSession PRIMARY KEY (ExternalUserId),
        CONSTRAINT FK_CpfSession_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT CK_CpfSession_Step CHECK (Step IN ('AWAITING_CPF', 'AWAITING_NAME', 'AWAITING_EMAIL'))
    );

    CREATE INDEX IX_CpfSession_UpdatedAt ON altdesk.CpfSession(UpdatedAt);
    PRINT 'Created table altdesk.CpfSession';
END
ELSE
    PRINT 'Table altdesk.CpfSession already exists, skipping.';
GO
