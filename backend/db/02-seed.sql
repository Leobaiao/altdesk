USE OmniChatDev;
GO

-- 1. Criar Tenant
DECLARE @TenantId UNIQUEIDENTIFIER = '42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D'; -- Fixo para facilitar devs
IF NOT EXISTS (SELECT * FROM omni.Tenant WHERE TenantId = @TenantId)
BEGIN
    INSERT INTO omni.Tenant (TenantId, Name) VALUES (@TenantId, 'Ambiente Dev');
END

-- 2. Assinatura
IF NOT EXISTS (SELECT * FROM omni.Subscription WHERE TenantId = @TenantId)
BEGIN
    INSERT INTO omni.Subscription (TenantId, AgentsSeatLimit, ExpiresAt)
    VALUES (@TenantId, 10, DATEADD(YEAR, 1, SYSUTCDATETIME()));
END

-- 3. Usuário Admin (Empresa Dev)
DECLARE @UserId UNIQUEIDENTIFIER = '99999999-9999-9999-9999-999999999999';
IF NOT EXISTS (SELECT * FROM omni.[User] WHERE Email = 'admin@teste.com')
BEGIN
    INSERT INTO omni.[User] (UserId, TenantId, Email, PasswordHash, Role, IsActive)
    VALUES (@UserId, @TenantId, 'admin@teste.com', 0x__PASSWORD_HASH__, 'ADMIN', 1);
END

-- 3.1 Usuário SuperAdmin (Global)
DECLARE @SA_UserId UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888888';
IF NOT EXISTS (SELECT * FROM omni.[User] WHERE Email = 'superadmin@teste.com')
BEGIN
    INSERT INTO omni.[User] (UserId, TenantId, Email, PasswordHash, Role, IsActive)
    VALUES (@SA_UserId, @TenantId, 'superadmin@teste.com', 0x__PASSWORD_HASH__, 'SUPERADMIN', 1);
END

-- 4. Channel & Connector
DECLARE @ChannelId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
IF NOT EXISTS (SELECT * FROM omni.Channel WHERE ChannelId = @ChannelId)
BEGIN
    INSERT INTO omni.Channel (ChannelId, TenantId, Name) VALUES (@ChannelId, @TenantId, 'Canal WhatsApp');
END

IF NOT EXISTS (SELECT * FROM omni.ChannelConnector WHERE ConnectorId = 'whatsapp-gti-dev')
BEGIN
    INSERT INTO omni.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson, WebhookSecret)
    VALUES (
        'whatsapp-gti-dev',
        @ChannelId,
        'GTI',
        '{"baseUrl":"https://api.gtiapi.workers.dev", "token":"DEMO_TOKEN", "instance":"dev"}',
        'segredo-webhook'
    );
END
GO
