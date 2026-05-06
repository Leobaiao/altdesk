-- Script para popular dados de teste para o Portal do Solicitante
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
DECLARE @tenantId UNIQUEIDENTIFIER;
SELECT TOP 1 @tenantId = TenantId FROM altdesk.Tenant WHERE Name = 'Tenant Dev';

IF @tenantId IS NOT NULL
BEGIN
    -- 1. Criar Role de Colaborador se não existir
    IF NOT EXISTS (SELECT 1 FROM altdesk.Role WHERE TenantId = @tenantId AND Name = 'Colaborador/Funcionário')
    BEGIN
        INSERT INTO altdesk.Role (TenantId, Name)
        VALUES (@tenantId, 'Colaborador/Funcionário');
    END

    -- 2. Criar Usuário Solicitante (Senha: 123456 - Hash padrão do sistema se houver)
    DECLARE @adminHash VARBINARY(MAX);
    SELECT TOP 1 @adminHash = PasswordHash FROM altdesk.[User] WHERE Email = 'admin@admin.com';

    DECLARE @requesterId UNIQUEIDENTIFIER = NEWID();
    IF NOT EXISTS (SELECT 1 FROM altdesk.[User] WHERE Email = 'solicitante@altdesk.com')
    BEGIN
        INSERT INTO altdesk.[User] (UserId, TenantId, Email, DisplayName, PasswordHash, Role, IsActive, Position)
        VALUES (@requesterId, @tenantId, 'solicitante@altdesk.com', 'Carlos Solicitante', @adminHash, 'END_USER', 1, 'Auxiliar de TI');
        
        -- 3. Vincular um chamado (Conversation) a este usuário
        DECLARE @channelId UNIQUEIDENTIFIER;
        SELECT TOP 1 @channelId = ChannelId FROM altdesk.Channel WHERE TenantId = @tenantId;

        IF @channelId IS NOT NULL
        BEGIN
            DECLARE @convId UNIQUEIDENTIFIER = NEWID();
            INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, Title, Status, RequesterUserId)
            VALUES (@convId, @tenantId, @channelId, 'Dúvida sobre o Portal', 'OPEN', @requesterId);

            -- 4. Criar o Ticket (A tabela Ticket deve existir)
            IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Ticket' AND schema_id = SCHEMA_ID('altdesk'))
            BEGIN
                INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Status, Priority)
                VALUES (NEWID(), @tenantId, @convId, 'OPEN', 'MEDIUM');
            END
        END
    END
END
GO
