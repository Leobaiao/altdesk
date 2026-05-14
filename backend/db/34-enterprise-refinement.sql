-- Migration: Enterprise Refinement
-- Refinamento de dados para Auditoria, SLA, Tenant Settings e Contatos

-- 1. Tenant Settings
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'altdesk.TenantSettings') AND type in (N'U'))
BEGIN
    CREATE TABLE altdesk.TenantSettings (
        TenantId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        KanbanColumnsJson NVARCHAR(MAX) DEFAULT '{"new":"Novo","open":"Aberto","pending":"Pendente","resolved":"Resolvido"}',
        Timezone NVARCHAR(50) DEFAULT 'America/Sao_Paulo',
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_TenantSettings_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId)
    );
END
GO

-- 2. Ticket Attachments (Storage no disco)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'altdesk.TicketAttachment') AND type in (N'U'))
BEGIN
    CREATE TABLE altdesk.TicketAttachment (
        AttachmentId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        TicketId UNIQUEIDENTIFIER NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        StoragePath NVARCHAR(500) NOT NULL,
        ContentType NVARCHAR(100) NULL,
        FileSize BIGINT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        DeletedAt DATETIME2 NULL,
        CONSTRAINT FK_Attachment_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_Attachment_Ticket FOREIGN KEY (TicketId) REFERENCES altdesk.Ticket(TicketId)
    );
END
GO

-- 3. SLA Framework Enhancements
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.SLAPolicy') AND name = 'ScheduleType')
BEGIN
    ALTER TABLE altdesk.SLAPolicy ADD ScheduleType NVARCHAR(20) DEFAULT '24x7'; -- 'commercial', 'extended', '24x7'
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Ticket') AND name = 'SlaPercentage')
BEGIN
    ALTER TABLE altdesk.Ticket ADD SlaPercentage DECIMAL(5,2) DEFAULT 0.00;
END
GO

-- 4. Contacts Enhancements
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Contact') AND name = 'Origin')
BEGIN
    ALTER TABLE altdesk.Contact ADD 
        Origin NVARCHAR(100) NULL,
        Channel NVARCHAR(50) NULL,
        Campaign NVARCHAR(100) NULL,
        LastActivityAt DATETIME2 NULL;
END
GO

-- 5. Soft Delete Verification for Audit & Policies
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.SLAPolicy') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.SLAPolicy ADD DeletedAt DATETIME2 NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.TicketEvent') AND name = 'DeletedAt')
BEGIN
    ALTER TABLE altdesk.TicketEvent ADD DeletedAt DATETIME2 NULL;
END
GO
