-- Migration: Atribuição de Instâncias a Funcionários
-- Autor: Antigravity

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InstanceAssignment' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.InstanceAssignment (
        AssignmentId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        ConnectorId NVARCHAR(100) NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_InstanceAssignment_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_InstanceAssignment_Connector FOREIGN KEY (ConnectorId) REFERENCES altdesk.ChannelConnector(ConnectorId),
        CONSTRAINT FK_InstanceAssignment_User FOREIGN KEY (UserId) REFERENCES altdesk.[User](UserId),
        CONSTRAINT UK_InstanceAssignment UNIQUE (ConnectorId, UserId)
    );

    CREATE INDEX IX_InstanceAssignment_User ON altdesk.InstanceAssignment(UserId);
    CREATE INDEX IX_InstanceAssignment_Connector ON altdesk.InstanceAssignment(ConnectorId);
    CREATE INDEX IX_InstanceAssignment_Tenant ON altdesk.InstanceAssignment(TenantId);
END
GO

PRINT 'Migration: InstanceAssignment criada com sucesso.';
GO
