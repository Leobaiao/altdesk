-- Migration 47: Internal Chat Provider
-- Creates INTERNAL Channel + ChannelConnector per tenant so that
-- internal chat appears as a real provider in the connector list.

-- For each tenant, ensure an INTERNAL Channel + ChannelConnector exists
DECLARE @tid UNIQUEIDENTIFIER;
DECLARE tenant_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT TenantId FROM altdesk.Tenant WHERE DeletedAt IS NULL;

OPEN tenant_cursor;
FETCH NEXT FROM tenant_cursor INTO @tid;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- 1. Create INTERNAL channel if not exists
    DECLARE @channelId UNIQUEIDENTIFIER;
    SELECT TOP 1 @channelId = ChannelId 
    FROM altdesk.Channel 
    WHERE TenantId = @tid AND Type = 'INTERNAL' AND IsActive = 1;

    IF @channelId IS NULL
    BEGIN
        SET @channelId = NEWID();
        INSERT INTO altdesk.Channel (ChannelId, TenantId, Name, Type, IsActive)
        VALUES (@channelId, @tid, N'Chat Interno', 'INTERNAL', 1);
    END

    -- 2. Create INTERNAL ChannelConnector if not exists for this channel
    DECLARE @connectorId NVARCHAR(100) = 'INTERNAL_' + CAST(@tid AS NVARCHAR(36));
    IF NOT EXISTS (SELECT 1 FROM altdesk.ChannelConnector WHERE ConnectorId = @connectorId)
    BEGIN
        INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, IsActive)
        VALUES (@connectorId, @channelId, 'INTERNAL', 1);
    END

    SET @channelId = NULL;
    FETCH NEXT FROM tenant_cursor INTO @tid;
END

CLOSE tenant_cursor;
DEALLOCATE tenant_cursor;
GO
