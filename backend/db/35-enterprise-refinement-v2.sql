USE AltDeskDev;
GO

-- 1. Enriquecimento da tabela Contact
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'Source')
    ALTER TABLE altdesk.Contact ADD [Source] NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'ChannelType')
    ALTER TABLE altdesk.Contact ADD [ChannelType] NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'Campaign')
    ALTER TABLE altdesk.Contact ADD [Campaign] NVARCHAR(255) NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'LastActivityAt')
    ALTER TABLE altdesk.Contact ADD [LastActivityAt] DATETIME2(7) NULL;
GO

-- 2. Garantir CreatedAt na tabela Tenant para auditoria de onboarding
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'CreatedAt')
BEGIN
    ALTER TABLE altdesk.Tenant ADD [CreatedAt] DATETIME2(7) DEFAULT SYSUTCDATETIME();
END
GO

-- 3. Procedure aprimorada para Purge de Dados
-- Permite limpar apenas dados criados antes de uma data específica (limpeza de demo)
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE altdesk.sp_altdesk_purge_tenant_data
(
    @tenant_id UNIQUEIDENTIFIER,
    @cutoff_date DATETIME2 = NULL -- Se null, limpa TUDO. Se passar data, limpa o que foi criado ANTES.
)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Se @cutoff_date for NULL, usamos uma data no futuro distante para pegar tudo
        DECLARE @limit DATETIME2 = ISNULL(@cutoff_date, '9999-12-31');

        -- 1. Deletar anexos de tickets
        DELETE FROM altdesk.TicketAttachment
        WHERE TicketId IN (SELECT TicketId FROM altdesk.Ticket WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        -- 2. Deletar eventos de tickets
        DELETE FROM altdesk.TicketEvent
        WHERE TicketId IN (SELECT TicketId FROM altdesk.Ticket WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        -- 3. Deletar Tickets
        DELETE FROM altdesk.Ticket
        WHERE TenantId = @tenant_id AND CreatedAt < @limit;

        -- 4. Deletar metadados de e-mail e retry queue de conversas
        DELETE FROM altdesk.EmailMessageMeta
        WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        DELETE FROM altdesk.EmailRetryQueue
        WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        -- 5. Deletar tags de conversas
        DELETE FROM altdesk.ConversationTag
        WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        -- 6. Deletar CSAT satisfaction ratings
        DELETE FROM altdesk.SatisfactionRating
        WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        -- 7. Deletar histórico de conversas
        DELETE FROM altdesk.ConversationHistory
        WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        -- 8. Deletar Mensagens e Conversas
        DELETE FROM altdesk.Message
        WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        DELETE FROM altdesk.Conversation
        WHERE TenantId = @tenant_id AND CreatedAt < @limit;

        -- 9. Deletar eventos de e-mail inbound
        DELETE FROM altdesk.EmailInboundEvent
        WHERE TenantId = @tenant_id AND CreatedAt < @limit;

        -- 10. Deletar Contatos
        DELETE FROM altdesk.Contact
        WHERE TenantId = @tenant_id AND CreatedAt < @limit;

        -- 11. Deletar atribuições de instâncias dos usuários demo ou criadas antes do limite
        DELETE FROM altdesk.InstanceAssignment
        WHERE TenantId = @tenant_id 
          AND (CreatedAt < @limit 
               OR UserId IN (SELECT UserId FROM altdesk.[User] WHERE TenantId = @tenant_id AND CreatedAt < @limit AND Role != 'ADMIN'));

        -- 12. Deletar agentes vinculados a usuários demo
        DELETE FROM altdesk.Agent
        WHERE TenantId = @tenant_id
          AND (CreatedAt < @limit
               OR UserId IN (SELECT UserId FROM altdesk.[User] WHERE TenantId = @tenant_id AND CreatedAt < @limit AND Role != 'ADMIN'));

        -- 13. Deletar tokens de password reset de usuários demo
        DELETE FROM altdesk.PasswordResetToken
        WHERE UserId IN (SELECT UserId FROM altdesk.[User] WHERE TenantId = @tenant_id AND CreatedAt < @limit AND Role != 'ADMIN');

        -- 14. Deletar usuários demo (Mantendo o usuário ADMIN principal)
        DELETE FROM altdesk.[User]
        WHERE TenantId = @tenant_id AND CreatedAt < @limit AND Role != 'ADMIN';

        -- 15. Deletar conectores de canais de demo ou criados antes do limite
        DELETE FROM altdesk.ChannelConnector
        WHERE ChannelId IN (SELECT ChannelId FROM altdesk.Channel WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        -- 16. Deletar canais criados antes do limite (ex: canais de demo)
        DELETE FROM altdesk.Channel
        WHERE TenantId = @tenant_id AND CreatedAt < @limit;

        -- Logs de Auditoria do Tenant também podem ser limpos
        -- DELETE FROM altdesk.AuditLog WHERE TenantId = @tenant_id AND CreatedAt < @limit;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
