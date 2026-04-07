USE AltDeskDev;
GO

-- 1. Adicionar AccountStatus ao Tenant
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'AccountStatus')
    ALTER TABLE altdesk.Tenant ADD AccountStatus NVARCHAR(20) NOT NULL DEFAULT 'TRIAL';
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- 2. Atualizar sp_altdesk_create_onboarding (Apenas a parte do Status)
-- Alterando a procedure existente (ja vista em 09-onboarding.sql)
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

        -- 1. Criar Tenant (Com AccountStatus = TRIAL)
        INSERT INTO altdesk.Tenant
        (
            TenantId, Name, TradeName, CpfCnpj, Email, Phone,
            ResponsibleName, ResponsibleEmail, ResponsiblePhone,
            Timezone, Locale, PreloadModel, IsDemo, AccountStatus,
            DefaultProvider, IsActive, CreatedAt
        )
        VALUES
        (
            @tenant_id, @company_name, @trade_name, @cpf_cnpj, @email, @phone,
            @admin_name, @admin_email, @admin_phone,
            ISNULL(@timezone, 'America/Sao_Paulo'), ISNULL(@locale, 'pt-BR'),
            @preload_model, @is_demo, 'TRIAL',
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
