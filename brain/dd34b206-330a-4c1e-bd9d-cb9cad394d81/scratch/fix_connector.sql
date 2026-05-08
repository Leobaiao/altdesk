-- Relink the conversation to the correct connector
UPDATE altdesk.ExternalThreadMap 
SET ConnectorId = '6E850811-ECDA-4A57-8BAB-73716615D923'
WHERE ConversationId = '252D7DD1-5635-4DD4-A37C-5D3849CA5C55';

-- Also update any other conversations that may be linked to the test connector
UPDATE altdesk.ExternalThreadMap 
SET ConnectorId = '6E850811-ECDA-4A57-8BAB-73716615D923'
WHERE ConnectorId = 'A45E1676-A820-46AD-8E51-4B414226CAC1';

-- Deactivate the test connector
UPDATE altdesk.ChannelConnector 
SET IsActive = 0 
WHERE ConnectorId = 'A45E1676-A820-46AD-8E51-4B414226CAC1';

-- Make sure the real connector has the baseUrl set
UPDATE altdesk.ChannelConnector 
SET ConfigJson = '{"baseUrl":"https://api.gtiapi.workers.dev","apiKey":"13df5ca9-9b29-439d-91a8-c521adcdf72c","instanceId":"r0fa0cd46fbbd57","instance":"r0fa0cd46fbbd57","phoneNumberId":"5511958851705","connectionStatus":"open"}'
WHERE ConnectorId = '6E850811-ECDA-4A57-8BAB-73716615D923';

-- Verify
SELECT ConnectorId, IsActive, ConfigJson FROM altdesk.ChannelConnector WHERE Provider = 'GTI';
GO
