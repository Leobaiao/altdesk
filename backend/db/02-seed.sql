USE AltDeskDev;
GO

-- 1. Criar Tenant
DECLARE @TenantId UNIQUEIDENTIFIER = '42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D'; -- Fixo para facilitar devs
IF NOT EXISTS (SELECT * FROM altdesk.Tenant WHERE TenantId = @TenantId)
BEGIN
    INSERT INTO altdesk.Tenant (TenantId, Name) VALUES (@TenantId, 'Ambiente Dev');
END

-- 2. Assinatura
IF NOT EXISTS (SELECT * FROM altdesk.Subscription WHERE TenantId = @TenantId)
BEGIN
    INSERT INTO altdesk.Subscription (TenantId, AgentsSeatLimit, ExpiresAt)
    VALUES (@TenantId, 10, DATEADD(YEAR, 1, SYSUTCDATETIME()));
END

-- 3. Usuário Admin (Empresa Dev)
DECLARE @UserId UNIQUEIDENTIFIER = '99999999-9999-9999-9999-999999999999';
IF NOT EXISTS (SELECT * FROM altdesk.[User] WHERE Email = 'admin@teste.com')
BEGIN
    INSERT INTO altdesk.[User] (UserId, TenantId, Email, PasswordHash, Role, IsActive)
    VALUES (@UserId, @TenantId, 'admin@teste.com', CAST('$2a$10$8v5Z2s1uRIdD6xHw5/s49eR9E2cM5n3K/Qv377oQ6r5/63Q0Yp.vG' AS VARBINARY(MAX)), 'ADMIN', 1);
END

-- 3.1 Usuário SuperAdmin (Global)
DECLARE @SA_UserId UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888888';
IF NOT EXISTS (SELECT * FROM altdesk.[User] WHERE Email = 'superadmin@teste.com')
BEGIN
    INSERT INTO altdesk.[User] (UserId, TenantId, Email, PasswordHash, Role, IsActive)
    VALUES (@SA_UserId, @TenantId, 'superadmin@teste.com', CAST('$2a$10$8v5Z2s1uRIdD6xHw5/s49eR9E2cM5n3K/Qv377oQ6r5/63Q0Yp.vG' AS VARBINARY(MAX)), 'SUPERADMIN', 1);
END

-- 4. Channel & Connector
DECLARE @ChannelId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
IF NOT EXISTS (SELECT * FROM altdesk.Channel WHERE ChannelId = @ChannelId)
BEGIN
    INSERT INTO altdesk.Channel (ChannelId, TenantId, Name) VALUES (@ChannelId, @TenantId, 'Canal WhatsApp');
END

IF NOT EXISTS (SELECT * FROM altdesk.ChannelConnector WHERE ConnectorId = 'A45E1676-A820-46AD-8E51-4B414226CAC1')
BEGIN
    INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson)
    VALUES (
        'A45E1676-A820-46AD-8E51-4B414226CAC1',
        @ChannelId,
        'GTI',
        '{"baseUrl":"https://evo.altdesk.com.br", "token":"d7ef03be-cce7-4725-9ce7-79afa277265b", "instance":"altdesk"}'
    );
END
GO
