-- Migration: Kanban, SLA and Escalation support
-- Expand Ticket table (Idempotent)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'altdesk.Ticket') AND name = 'KanbanOrder')
BEGIN
    ALTER TABLE altdesk.Ticket ADD 
        KanbanOrder INT NOT NULL DEFAULT 0,
        SLAFirstResponseDue DATETIME2 NULL,
        SLAResolutionDue DATETIME2 NULL,
        FirstResponseAt DATETIME2 NULL,
        ResolvedAt DATETIME2 NULL,
        SlaStatus NVARCHAR(20) NOT NULL DEFAULT 'ON_TIME',
        SlaPaused BIT NOT NULL DEFAULT 0,
        SlaPausedAt DATETIME2 NULL,
        SlaPauseDurationMinutes INT NOT NULL DEFAULT 0,
        EscalatedAt DATETIME2 NULL,
        EscalationReason NVARCHAR(MAX) NULL;
END
GO

-- Create SLAPolicy table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'altdesk.SLAPolicy') AND type in (N'U'))
BEGIN
    CREATE TABLE altdesk.SLAPolicy (
        PolicyId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Priority NVARCHAR(20) NOT NULL,
        FirstResponseMinutes INT NOT NULL,
        ResolutionMinutes INT NOT NULL,
        WarningBeforeMinutes INT NOT NULL DEFAULT 10,
        BusinessHoursOnly BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_SLAPolicy_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId)
    );
    CREATE INDEX IX_SLAPolicy_Tenant_Priority ON altdesk.SLAPolicy(TenantId, Priority);
END
GO

-- Create EscalationPolicy table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'altdesk.EscalationPolicy') AND type in (N'U'))
BEGIN
    CREATE TABLE altdesk.EscalationPolicy (
        PolicyId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Level INT NOT NULL,
        AssignToRole NVARCHAR(50) NOT NULL,
        NotifyEmail BIT NOT NULL DEFAULT 1,
        NotifyInApp BIT NOT NULL DEFAULT 1,
        NotifyWebhook BIT NOT NULL DEFAULT 1,
        MaxLevel INT NOT NULL DEFAULT 3,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_EscalationPolicy_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId)
    );
    CREATE INDEX IX_EscalationPolicy_Tenant_Level ON altdesk.EscalationPolicy(TenantId, Level);
END
GO

-- Create TicketEvent table for auditing
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'altdesk.TicketEvent') AND type in (N'U'))
BEGIN
    CREATE TABLE altdesk.TicketEvent (
        EventId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        TicketId UNIQUEIDENTIFIER NOT NULL,
        ActorUserId UNIQUEIDENTIFIER NULL,
        EventType NVARCHAR(50) NOT NULL,
        OldValue NVARCHAR(MAX) NULL,
        NewValue NVARCHAR(MAX) NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_TicketEvent_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_TicketEvent_Ticket FOREIGN KEY (TicketId) REFERENCES altdesk.Ticket(TicketId),
        CONSTRAINT FK_TicketEvent_User FOREIGN KEY (ActorUserId) REFERENCES altdesk.[User](UserId)
    );
    CREATE INDEX IX_TicketEvent_Ticket ON altdesk.TicketEvent(TicketId, CreatedAt DESC);
END
GO

-- Default SLA Seeds for existing tenants (Triggered by app/script or run manually)
-- This assumes priority values are LOW, MEDIUM, HIGH, CRITICAL.
