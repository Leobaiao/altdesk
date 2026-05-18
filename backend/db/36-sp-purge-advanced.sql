USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- PROCEDURE COM SELEÇÃO DE MÓDULOS PARA PURGE
CREATE OR ALTER PROCEDURE altdesk.sp_altdesk_purge_tenant_data
(
    @tenant_id UNIQUEIDENTIFIER,
    @cutoff_date DATETIME2 = NULL,
    @purge_tickets BIT = 1,
    @purge_contacts BIT = 1,
    @purge_users BIT = 1,
    @purge_channels BIT = 1
)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Se @cutoff_date for NULL, usamos uma data no futuro distante para pegar tudo
        DECLARE @limit DATETIME2 = ISNULL(@cutoff_date, '9999-12-31');

        -- 1. Deletar tickets, anexos e eventos
        IF @purge_tickets = 1
        BEGIN
            DELETE FROM altdesk.TicketAttachment
            WHERE TicketId IN (SELECT TicketId FROM altdesk.Ticket WHERE TenantId = @tenant_id AND CreatedAt < @limit);

            DELETE FROM altdesk.TicketEvent
            WHERE TicketId IN (SELECT TicketId FROM altdesk.Ticket WHERE TenantId = @tenant_id AND CreatedAt < @limit);

            DELETE FROM altdesk.Ticket
            WHERE TenantId = @tenant_id AND CreatedAt < @limit;
        END

        -- 2. Deletar conversas/mensagens se solicitado (ou se tickets/contatos correspondentes forem limpos)
        IF @purge_tickets = 1 OR @purge_contacts = 1
        BEGIN
            DELETE FROM altdesk.EmailMessageMeta
            WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

            DELETE FROM altdesk.EmailRetryQueue
            WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

            DELETE FROM altdesk.ConversationTag
            WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

            DELETE FROM altdesk.SatisfactionRating
            WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

            DELETE FROM altdesk.ConversationHistory
            WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

            DELETE FROM altdesk.Message
            WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

            DELETE FROM altdesk.Conversation
            WHERE TenantId = @tenant_id AND CreatedAt < @limit;

            DELETE FROM altdesk.EmailInboundEvent
            WHERE TenantId = @tenant_id AND CreatedAt < @limit;
        END

        -- 3. Deletar Contatos
        IF @purge_contacts = 1
        BEGIN
            DELETE FROM altdesk.Contact
            WHERE TenantId = @tenant_id AND CreatedAt < @limit;
        END

        -- 4. Deletar usuários adicionais (exceto ADMIN principal)
        IF @purge_users = 1
        BEGIN
            DELETE FROM altdesk.InstanceAssignment
            WHERE TenantId = @tenant_id 
              AND (CreatedAt < @limit 
                   OR UserId IN (SELECT UserId FROM altdesk.[User] WHERE TenantId = @tenant_id AND CreatedAt < @limit AND Role != 'ADMIN'));

            DELETE FROM altdesk.Agent
            WHERE TenantId = @tenant_id
              AND (CreatedAt < @limit
                   OR UserId IN (SELECT UserId FROM altdesk.[User] WHERE TenantId = @tenant_id AND CreatedAt < @limit AND Role != 'ADMIN'));

            DELETE FROM altdesk.PasswordResetToken
            WHERE UserId IN (SELECT UserId FROM altdesk.[User] WHERE TenantId = @tenant_id AND CreatedAt < @limit AND Role != 'ADMIN');

            DELETE FROM altdesk.[User]
            WHERE TenantId = @tenant_id AND CreatedAt < @limit AND Role != 'ADMIN';
        END

        -- 5. Deletar conectores e canais adicionais
        IF @purge_channels = 1
        BEGIN
            DELETE FROM altdesk.ChannelConnector
            WHERE ChannelId IN (SELECT ChannelId FROM altdesk.Channel WHERE TenantId = @tenant_id AND CreatedAt < @limit);

            DELETE FROM altdesk.Channel
            WHERE TenantId = @tenant_id AND CreatedAt < @limit;
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
