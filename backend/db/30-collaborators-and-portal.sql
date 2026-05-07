-- SQL Migration: Módulo Colaboradores e Portal do Solicitante

-- 1. Certificar que a Role END_USER existe
-- Note: A tabela de roles no backend é altdesk.Role
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'altdesk' AND t.name = 'Role')
BEGIN
    CREATE TABLE altdesk.Role (
        RoleId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(50) NOT NULL,
        CanOpen BIT NOT NULL DEFAULT 1,
        CanEscalate BIT NOT NULL DEFAULT 0,
        CanClose BIT NOT NULL DEFAULT 0,
        CanComment BIT NOT NULL DEFAULT 1,
        HourlyValue DECIMAL(18,2) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        DeletedAt DATETIME2 NULL,
        CONSTRAINT FK_Role_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId)
    );
END
GO

-- 2. Adicionar coluna status na tabela User se não existir
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.[User]') AND name = 'Status')
BEGIN
    ALTER TABLE altdesk.[User] ADD Status NVARCHAR(20) DEFAULT 'active';
END
GO

-- 3. Adicionar RequesterUserId na tabela Conversation para o Portal do Solicitante
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Conversation') AND name = 'RequesterUserId')
BEGIN
    ALTER TABLE altdesk.Conversation ADD RequesterUserId UNIQUEIDENTIFIER NULL;
    ALTER TABLE altdesk.Conversation ADD CONSTRAINT FK_Conversation_RequesterUser FOREIGN KEY (RequesterUserId) REFERENCES altdesk.[User](UserId);
END
GO

-- 4. Garantir Role END_USER em todos os tenants existentes para o seed
-- Como altdesk.Role depende de TenantId, vamos inserir para cada tenant se necessário.
INSERT INTO altdesk.Role (TenantId, Name)
SELECT TenantId, 'Colaborador (Solicitante)'
FROM altdesk.Tenant t
WHERE NOT EXISTS (SELECT 1 FROM altdesk.Role r WHERE r.TenantId = t.TenantId AND r.Name = 'Colaborador (Solicitante)');
GO
