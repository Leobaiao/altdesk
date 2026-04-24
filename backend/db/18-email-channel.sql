USE AltDeskDev;
GO

-- 1. Criar Canal de Email para o Tenant de Dev
DECLARE @TenantId UNIQUEIDENTIFIER = '42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D';
DECLARE @EmailChannelId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';

IF NOT EXISTS (SELECT * FROM altdesk.Channel WHERE ChannelId = @EmailChannelId)
BEGIN
    INSERT INTO altdesk.Channel (ChannelId, TenantId, Name, Type) 
    VALUES (@EmailChannelId, @TenantId, 'Canal Email (Suporte)', 'EMAIL');
    
    PRINT 'Canal de Email criado.';
END

-- 2. Criar Conector SMTP para o Canal
IF NOT EXISTS (SELECT * FROM altdesk.ChannelConnector WHERE ConnectorId = 'EMAIL_DEV_CONNECTOR')
BEGIN
    INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson)
    VALUES (
        'EMAIL_DEV_CONNECTOR',
        @EmailChannelId,
        'SMTP',
        '{"host":"localhost", "port":1025, "secure":false, "user":"dev@altdesk.com", "pass":"devpass", "from":"AltDesk Support <dev@altdesk.com>"}'
    );
    
    PRINT 'Conector SMTP de Dev criado.';
END
GO
