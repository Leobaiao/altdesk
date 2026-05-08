UPDATE altdesk.ChannelConnector 
SET ConfigJson = '{"baseUrl":"https://api.gtiapi.workers.dev", "token":"d7ef03be-cce7-4725-9ce7-79afa277265b", "instance":"altdesk"}' 
WHERE ConnectorId = 'A45E1676-A820-46AD-8E51-4B414226CAC1';

SELECT ConnectorId, ConfigJson FROM altdesk.ChannelConnector WHERE ConnectorId = 'A45E1676-A820-46AD-8E51-4B414226CAC1';
GO
