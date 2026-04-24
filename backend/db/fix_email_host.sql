UPDATE altdesk.ChannelConnector 
SET ConfigJson = '{"host":"mailhog", "port":1025, "secure":false, "user":"dev@altdesk.com", "pass":"devpass", "from":"AltDesk Support <dev@altdesk.com>"}' 
WHERE ConnectorId = 'EMAIL_DEV_CONNECTOR';
GO
