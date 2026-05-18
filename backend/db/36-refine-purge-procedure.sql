USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ──────────────────────────────────────────────────────────────
-- Procedure para limpeza de dados transacionais/demo
-- Mantem a estrutura mas deleta o "lixo" gerado no onboarding
-- REFINADA: Mantem registros criados MANUALMENTE após o onboarding
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

        DECLARE @onboardingDate DATETIME2;
        SELECT @onboardingDate = CreatedAt FROM altdesk.Tenant WHERE TenantId = @tenant_id;

        -- Se não encontrar o tenant, sai
        IF @onboardingDate IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- 1. Deletar Tickets e eventos vinculados (criados no onboarding)
        DELETE FROM altdesk.TicketEvent
        WHERE TicketId IN (SELECT TicketId FROM altdesk.Ticket WHERE TenantId = @tenant_id AND CreatedAt <= @onboardingDate);

        DELETE FROM altdesk.Ticket
        WHERE TenantId = @tenant_id AND CreatedAt <= @onboardingDate;

        -- 2. Deletar Mensagens e Conversas (criadas no onboarding)
        DELETE FROM altdesk.Message
        WHERE TenantId = @tenant_id AND CreatedAt <= @onboardingDate;

        -- Deleta conversas que foram criadas no onboarding
        DELETE FROM altdesk.Conversation
        WHERE TenantId = @tenant_id AND CreatedAt <= @onboardingDate;

        -- 3. Deletar Contatos (criados no onboarding)
        DELETE FROM altdesk.Contact
        WHERE TenantId = @tenant_id AND CreatedAt <= @onboardingDate;

        -- 4. Deletar Artigos de Conhecimento e FAQ (criados no onboarding)
        DELETE FROM altdesk.KnowledgeArticle
        WHERE TenantId = @tenant_id AND CreatedAt <= @onboardingDate;

        -- 5. Deletar Respostas Rapidas (Canned Responses) (criadas no onboarding)
        DELETE FROM altdesk.CannedResponse
        WHERE TenantId = @tenant_id AND CreatedAt <= @onboardingDate;

        -- 6. Remover Usuários Demo (Agentes criados no onboarding que não sejam o Admin principal)
        -- O Admin principal é o que tem o email igual ao ResponsibleEmail do Tenant
        DECLARE @adminEmail NVARCHAR(200);
        SELECT @adminEmail = ResponsibleEmail FROM altdesk.Tenant WHERE TenantId = @tenant_id;

        DELETE FROM altdesk.Agent
        WHERE TenantId = @tenant_id 
          AND CreatedAt <= @onboardingDate
          AND UserId NOT IN (SELECT UserId FROM altdesk.[User] WHERE TenantId = @tenant_id AND Email = @adminEmail);

        DELETE FROM altdesk.[User]
        WHERE TenantId = @tenant_id 
          AND CreatedAt <= @onboardingDate
          AND Email <> @adminEmail;

        -- 7. Remover Instancias de Canal Dummy/Demo (se houver)
        DELETE FROM altdesk.InstanceAssignment
        WHERE TenantId = @tenant_id AND ConnectorId LIKE 'demo_%';

        DELETE FROM altdesk.ChannelConnector
        WHERE ConnectorId LIKE 'demo_%' AND ChannelId IN (SELECT ChannelId FROM altdesk.Channel WHERE TenantId = @tenant_id);

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
