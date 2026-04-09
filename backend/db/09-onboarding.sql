USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO


-- ──────────────────────────────────────────────────────────────
-- 1. ALTER TABLE Tenant — Campos de cadastro do onboarding
-- ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'TradeName')
    ALTER TABLE altdesk.Tenant ADD TradeName NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'CpfCnpj')
    ALTER TABLE altdesk.Tenant ADD CpfCnpj NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'Email')
    ALTER TABLE altdesk.Tenant ADD Email NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'Phone')
    ALTER TABLE altdesk.Tenant ADD Phone NVARCHAR(30) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'ResponsibleName')
    ALTER TABLE altdesk.Tenant ADD ResponsibleName NVARCHAR(150) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'ResponsibleEmail')
    ALTER TABLE altdesk.Tenant ADD ResponsibleEmail NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'ResponsiblePhone')
    ALTER TABLE altdesk.Tenant ADD ResponsiblePhone NVARCHAR(30) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'Timezone')
    ALTER TABLE altdesk.Tenant ADD Timezone NVARCHAR(80) NULL DEFAULT 'America/Sao_Paulo';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'Locale')
    ALTER TABLE altdesk.Tenant ADD Locale NVARCHAR(20) NULL DEFAULT 'pt-BR';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'PreloadModel')
    ALTER TABLE altdesk.Tenant ADD PreloadModel NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'IsDemo')
    ALTER TABLE altdesk.Tenant ADD IsDemo BIT NOT NULL DEFAULT 0;
GO

-- ──────────────────────────────────────────────────────────────
-- 2. Procedure principal de onboarding
-- ──────────────────────────────────────────────────────────────
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE sp_altdesk_create_onboarding
(
    @company_name         NVARCHAR(100),
    @trade_name           NVARCHAR(200),
    @cpf_cnpj             NVARCHAR(20),
    @email                NVARCHAR(200),
    @phone                NVARCHAR(30),
    @admin_name           NVARCHAR(100),
    @admin_email          NVARCHAR(200),
    @admin_phone          NVARCHAR(30),
    @admin_password_hash  VARBINARY(MAX),
    @timezone             NVARCHAR(80),
    @locale               NVARCHAR(20),
    @preload_model        NVARCHAR(20)  -- empty, basic, demo
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @tenant_id   UNIQUEIDENTIFIER = NEWID();
        DECLARE @admin_id    UNIQUEIDENTIFIER = NEWID();
        DECLARE @is_demo     BIT = CASE WHEN @preload_model = 'demo' THEN 1 ELSE 0 END;
        DECLARE @now         DATETIME2 = SYSUTCDATETIME();

        -- 1. Criar Tenant
        INSERT INTO altdesk.Tenant
        (
            TenantId, Name, TradeName, CpfCnpj, Email, Phone,
            ResponsibleName, ResponsibleEmail, ResponsiblePhone,
            Timezone, Locale, PreloadModel, IsDemo,
            DefaultProvider, IsActive, CreatedAt
        )
        VALUES
        (
            @tenant_id, @company_name, @trade_name, @cpf_cnpj, @email, @phone,
            @admin_name, @admin_email, @admin_phone,
            ISNULL(@timezone, 'America/Sao_Paulo'), ISNULL(@locale, 'pt-BR'),
            @preload_model, @is_demo,
            'GTI', 1, @now
        );

        -- 2. Criar usuário Admin
        INSERT INTO altdesk.[User]
        (
            UserId, TenantId, Email, PasswordHash, Role, Name, DisplayName,
            IsActive, CreatedAt
        )
        VALUES
        (
            @admin_id, @tenant_id, @admin_email, @admin_password_hash,
            'ADMIN', @admin_name, @admin_name,
            1, @now
        );

        -- 3. Criar Subscription trial (14 dias, 5 seats)
        INSERT INTO altdesk.Subscription
        (TenantId, IsActive, AgentsSeatLimit, ExpiresAt, CreatedAt)
        VALUES
        (@tenant_id, 1, 5, DATEADD(DAY, 14, @now), @now);

        -- 4. Criar filas padrão
        INSERT INTO altdesk.Queue (TenantId, Name, IsActive, CreatedAt)
        VALUES
            (@tenant_id, 'Suporte',    1, @now),
            (@tenant_id, 'Financeiro', 1, @now);

        -- 5. Aplicar seed conforme modelo
        IF @preload_model = 'basic'
            EXEC sp_altdesk_seed_basic @tenant_id, @admin_id;

        IF @preload_model = 'demo'
            EXEC sp_altdesk_seed_demo @tenant_id, @admin_id;

        COMMIT TRANSACTION;

        -- 6. Retornar IDs
        SELECT
            CAST(@tenant_id AS NVARCHAR(36)) AS TenantId,
            CAST(@admin_id AS NVARCHAR(36)) AS UserId;
            
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ──────────────────────────────────────────────────────────────
-- 3. Procedure seed básico
-- ──────────────────────────────────────────────────────────────
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE sp_altdesk_seed_basic
(
    @tenant_id  UNIQUEIDENTIFIER,
    @admin_id   UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @prefix NVARCHAR(8) = LOWER(LEFT(CAST(@tenant_id AS NVARCHAR(36)), 8));
    DECLARE @now DATETIME2 = SYSUTCDATETIME();

    -- 1 Agente exemplo (com login 123456)
    INSERT INTO altdesk.[User]
    (TenantId, Email, PasswordHash, Role, Name, DisplayName, IsActive, CreatedAt)
    VALUES
    (@tenant_id, CONCAT('agente.exemplo.', @prefix, '@demo.local'),
     -- Password '123456' hash
     CAST('$2b$10$B.10oi63pO.7yjwuOdD4a.y8irlF3yI0uIBBnhvXOp//gBtdKr/P.' AS VARBINARY(MAX)), 'AGENT', 'Agente Exemplo', 'Agente Exemplo', 1, @now);

    -- 5 Contatos
    INSERT INTO altdesk.Contact (TenantId, Name, Phone, Email, Tags, CreatedAt)
    VALUES
        (@tenant_id, 'Marcos Pereira',  '5511988881001', CONCAT('marcos.', @prefix, '@cliente.demo'),   '["Demonstração"]', @now),
        (@tenant_id, 'Fernanda Alves',  '5511988881002', CONCAT('fernanda.', @prefix, '@cliente.demo'), '["Demonstração"]', @now),
        (@tenant_id, N'João Batista',   '5511988881003', CONCAT('joao.', @prefix, '@cliente.demo'),     '["Demonstração"]', @now),
        (@tenant_id, 'Paula Mendes',    '5511988881004', CONCAT('paula.', @prefix, '@cliente.demo'),    '["Demonstração"]', @now),
        (@tenant_id, 'Ricardo Nunes',   '5511988881005', CONCAT('ricardo.', @prefix, '@cliente.demo'),  '["Demonstração"]', @now);
END;
GO

-- ──────────────────────────────────────────────────────────────
-- 4. Procedure seed demo (completo)
-- ──────────────────────────────────────────────────────────────
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE sp_altdesk_seed_demo
(
    @tenant_id  UNIQUEIDENTIFIER,
    @admin_id   UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @prefix NVARCHAR(8) = LOWER(LEFT(CAST(@tenant_id AS NVARCHAR(36)), 8));
    DECLARE @now DATETIME2 = SYSUTCDATETIME();

    -- Filas adicionais
    IF NOT EXISTS (SELECT 1 FROM altdesk.Queue WHERE TenantId = @tenant_id AND Name = N'Implantação')
        INSERT INTO altdesk.Queue (TenantId, Name, IsActive, CreatedAt)
        VALUES (@tenant_id, N'Implantação', 1, @now);

    IF NOT EXISTS (SELECT 1 FROM altdesk.Queue WHERE TenantId = @tenant_id AND Name = 'Comercial')
        INSERT INTO altdesk.Queue (TenantId, Name, IsActive, CreatedAt)
        VALUES (@tenant_id, 'Comercial', 1, @now);

    -- 4 Usuários internos demo (sem login)
    INSERT INTO altdesk.[User]
    (TenantId, Email, PasswordHash, Role, Name, DisplayName, Position, IsActive, CreatedAt)
    VALUES
    (@tenant_id, CONCAT('ana.souza.', @prefix, '@demo.local'),
     CAST('NO_LOGIN' AS VARBINARY(MAX)), 'AGENT', 'Ana Souza', 'Ana Souza', 'Supervisora', 1, @now),
    (@tenant_id, CONCAT('carlos.lima.', @prefix, '@demo.local'),
     CAST('NO_LOGIN' AS VARBINARY(MAX)), 'AGENT', 'Carlos Lima', 'Carlos Lima', 'Agente', 1, @now),
    (@tenant_id, CONCAT('juliana.rocha.', @prefix, '@demo.local'),
     CAST('NO_LOGIN' AS VARBINARY(MAX)), 'AGENT', 'Juliana Rocha', 'Juliana Rocha', 'Agente', 1, @now),
    (@tenant_id, CONCAT('rafael.torres.', @prefix, '@demo.local'),
     CAST('NO_LOGIN' AS VARBINARY(MAX)), 'AGENT', 'Rafael Torres', 'Rafael Torres', 'Analista Financeiro', 1, @now);

    -- 12 Contatos demo
    INSERT INTO altdesk.Contact (TenantId, Name, Phone, Email, Tags, CreatedAt)
    VALUES
        (@tenant_id, 'Marcos Pereira',   '5511988881001', CONCAT('marcos.', @prefix, '@cliente.demo'),    '["Demonstração"]', @now),
        (@tenant_id, 'Fernanda Alves',   '5511988881002', CONCAT('fernanda.', @prefix, '@cliente.demo'),  '["Demonstração"]', @now),
        (@tenant_id, N'João Batista',    '5511988881003', CONCAT('joao.', @prefix, '@cliente.demo'),      '["Demonstração"]', @now),
        (@tenant_id, 'Paula Mendes',     '5511988881004', CONCAT('paula.', @prefix, '@cliente.demo'),     '["Demonstração"]', @now),
        (@tenant_id, 'Ricardo Nunes',    '5511988881005', CONCAT('ricardo.', @prefix, '@cliente.demo'),   '["Demonstração"]', @now),
        (@tenant_id, 'Luciana Costa',    '5511988881006', CONCAT('luciana.', @prefix, '@cliente.demo'),   '["Demonstração"]', @now),
        (@tenant_id, 'Beatriz Lima',     '5511988881007', CONCAT('beatriz.', @prefix, '@cliente.demo'),   '["Demonstração"]', @now),
        (@tenant_id, 'Gustavo Azevedo',  '5511988881008', CONCAT('gustavo.', @prefix, '@cliente.demo'),   '["Demonstração"]', @now),
        (@tenant_id, 'Simone Prado',     '5511988881009', CONCAT('simone.', @prefix, '@cliente.demo'),    '["Demonstração"]', @now),
        (@tenant_id, 'Diego Martins',    '5511988881010', CONCAT('diego.', @prefix, '@cliente.demo'),     '["Demonstração"]', @now),
        (@tenant_id, 'Patricia Freitas', '5511988881011', CONCAT('patricia.', @prefix, '@cliente.demo'),  '["Demonstração"]', @now),
        (@tenant_id, 'Eduardo Ramos',    '5511988881012', CONCAT('eduardo.', @prefix, '@cliente.demo'),   '["Demonstração"]', @now);
END;
GO

PRINT 'Migration 09 (Onboarding & Seed) concluida com sucesso.';
GO
