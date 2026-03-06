-- Seed mínimo para dev (ajuste depois)
DECLARE @tenant UNIQUEIDENTIFIER = NEWID();
INSERT INTO omni.Tenant (TenantId, Name) VALUES (@tenant, 'Tenant Dev');

INSERT INTO omni.Subscription (TenantId, PlanCode, AgentsSeatLimit, StartsAt, ExpiresAt, IsActive)
VALUES (@tenant, 'DEV', 25, SYSUTCDATETIME(), DATEADD(day, 365, SYSUTCDATETIME()), 1);

-- Usuário admin: senha deve ser definida via app (hash bcrypt). Este seed não cria usuário por simplicidade.
-- Crie um user via script manual ou endpoint admin quando implementar.

-- Canal WhatsApp GTI placeholder
DECLARE @ch UNIQUEIDENTIFIER = NEWID();
INSERT INTO omni.Channel (ChannelId, TenantId, Type, Name) VALUES (@ch, @tenant, 'WHATSAPP', 'WhatsApp GTI');

INSERT INTO omni.ChannelConnector (ChannelId, Provider, RoutingKey, ConfigJson, IsActive)
VALUES (@ch, 'GTI', NULL, N'{"baseUrl":"","token":"","instance":""}', 1);

-- Respostas prontas exemplo
INSERT INTO omni.CannedResponse (TenantId, Title, Category, ChannelType, Body)
VALUES
(@tenant, N'Boas-vindas', N'Geral', 'WHATSAPP', N'Olá! Recebi sua mensagem e já vou te ajudar. Pode me dizer seu nome e o que precisa?'),
(@tenant, N'Fora do horário', N'Geral', 'WHATSAPP', N'Estamos fora do horário agora, mas registramos seu contato. Retornaremos no próximo expediente.');

