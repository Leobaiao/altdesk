USE AltDeskDev;
GO

-- 1. Enriquecimento da tabela Contact
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'Source')
BEGIN
    ALTER TABLE altdesk.Contact ADD [Source] NVARCHAR(100) NULL;
    ALTER TABLE altdesk.Contact ADD [ChannelType] NVARCHAR(50) NULL;
    ALTER TABLE altdesk.Contact ADD [Campaign] NVARCHAR(255) NULL;
    ALTER TABLE altdesk.Contact ADD [LastActivityAt] DATETIME2(7) NULL;
END
GO

-- 2. Garantir CreatedAt na tabela Tenant para auditoria de onboarding
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Tenant') AND name = 'CreatedAt')
BEGIN
    ALTER TABLE altdesk.Tenant ADD [CreatedAt] DATETIME2(7) DEFAULT SYSUTCDATETIME();
END
GO

-- 3. Procedure aprimorada para Purge de Dados
-- Permite limpar apenas dados criados antes de uma data específica (limpeza de demo)
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

        -- Deletar Tickets e eventos vinculados
        DELETE FROM altdesk.TicketEvent
        WHERE TicketId IN (SELECT TicketId FROM altdesk.Ticket WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        DELETE FROM altdesk.Ticket
        WHERE TenantId = @tenant_id AND CreatedAt < @limit;

        -- Deletar Mensagens e Conversas
        DELETE FROM altdesk.Message
        WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tenant_id AND CreatedAt < @limit);

        DELETE FROM altdesk.Conversation
        WHERE TenantId = @tenant_id AND CreatedAt < @limit;

        -- Deletar Contatos
        DELETE FROM altdesk.Contact
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
