USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ──────────────────────────────────────────────────────────────
-- Procedure para limpeza de dados transacionais/demo
-- Mantem a estrutura (Logo, Horarios, Usuarios) mas deleta o "lixo"
-- ──────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE altdesk.sp_altdesk_purge_demo_data
(
    @tenant_id UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Deletar Tickets e eventos vinculados
        DELETE FROM altdesk.TicketEvent
        WHERE TicketId IN (SELECT TicketId FROM altdesk.Ticket WHERE TenantId = @tenant_id);

        DELETE FROM altdesk.Ticket
        WHERE TenantId = @tenant_id;

        -- 2. Deletar Mensagens e Conversas
        DELETE FROM altdesk.Message
        WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id);

        DELETE FROM altdesk.Conversation
        WHERE TenantId = @tenant_id;

        -- 3. Deletar Contatos (Limpando o banco de leads fake)
        DELETE FROM altdesk.Contact
        WHERE TenantId = @tenant_id;

        -- 4. Deletar Artigos de Conhecimento e FAQ de exemplo
        DELETE FROM altdesk.KnowledgeArticle
        WHERE TenantId = @tenant_id;

        -- 5. Deletar Respostas Rapidas (Canned Responses)
        DELETE FROM altdesk.CannedResponse
        WHERE TenantId = @tenant_id;

        -- 6. Remover Instancias de Canal Dummy/Demo
        -- Primeiro remove assignments
        DELETE FROM altdesk.InstanceAssignment
        WHERE TenantId = @tenant_id AND ConnectorId LIKE 'demo_%';

        -- Remove conectores
        DELETE FROM altdesk.ChannelConnector
        WHERE ConnectorId LIKE 'demo_%' AND ChannelId IN (SELECT ChannelId FROM altdesk.Channel WHERE TenantId = @tenant_id);

        -- Remove canais marcados como Demo
        DELETE FROM altdesk.Channel
        WHERE TenantId = @tenant_id AND (Name LIKE '%(Demonstração)%' OR Name LIKE '%(Demo)%');

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
