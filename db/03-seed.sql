-- Seed mínimo para dev (ajuste depois)
DECLARE @tenant UNIQUEIDENTIFIER = NEWID();
INSERT INTO omni.Tenant (TenantId, Name) VALUES (@tenant, 'Tenant Dev');

INSERT INTO omni.Subscription (TenantId, PlanCode, AgentsSeatLimit, StartsAt, ExpiresAt, IsActive)
VALUES (@tenant, 'DEV', 25, SYSUTCDATETIME(), DATEADD(day, 365, SYSUTCDATETIME()), 1);

-- User admin
INSERT INTO omni.[User] (TenantId, Email, DisplayName, PasswordHash, Role, IsActive)
VALUES (@tenant, 'admin@admin.com', 'Admin Dev', 0x__PASSWORD_HASH__, 'ADMIN', 1);

-- Canal WhatsApp GTI
DECLARE @ch UNIQUEIDENTIFIER = NEWID();
INSERT INTO omni.Channel (ChannelId, TenantId, Type, Name) VALUES (@ch, @tenant, 'WHATSAPP', 'WhatsApp GTI');

INSERT INTO omni.ChannelConnector (ConnectorId, ChannelId, Provider, RoutingKey, ConfigJson, IsActive)
VALUES ('whatsapp-gti-dev', @ch, 'GTI', NULL, N'{"baseUrl":"","token":"","instance":""}', 1);

-- Respostas prontas exemplo
INSERT INTO omni.CannedResponse (TenantId, Title, Category, ChannelType, Shortcut, Content, Body)
VALUES
(@tenant, N'Boas-vindas', N'Geral', 'WHATSAPP', '/ola', N'Olá! Recebi sua mensagem', N'Olá! Recebi sua mensagem e já vou te ajudar. Pode me dizer seu nome e o que precisa?'),
(@tenant, N'Fora do horário', N'Geral', 'WHATSAPP', '/fora', N'Estamos fora do horário hoje', N'Estamos fora do horário agora, mas registramos seu contato. Retornaremos no próximo expediente.');

