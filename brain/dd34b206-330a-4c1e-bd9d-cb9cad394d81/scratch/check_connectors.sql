-- Ver TODOS os conectores e suas configs
SELECT ConnectorId, Provider, ChannelId, IsActive, ConfigJson FROM altdesk.ChannelConnector;
GO

-- Ver qual conector está vinculado à conversa problemática
SELECT etm.ConnectorId, etm.ExternalChatId, etm.ConversationId, cc.ConfigJson
FROM altdesk.ExternalThreadMap etm
JOIN altdesk.ChannelConnector cc ON cc.ConnectorId = etm.ConnectorId
WHERE etm.ConversationId = '252D7DD1-5635-4DD4-A37C-5D3849CA5C55';
GO
