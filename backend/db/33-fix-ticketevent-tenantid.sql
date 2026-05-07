-- Migration 33: Add missing TenantId to TicketEvent
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'altdesk.TicketEvent') AND name = 'TenantId')
BEGIN
    ALTER TABLE altdesk.TicketEvent ADD TenantId UNIQUEIDENTIFIER NULL;
    
    -- Backfill TenantId from Ticket if possible
    EXEC('UPDATE te SET te.TenantId = t.TenantId FROM altdesk.TicketEvent te JOIN altdesk.Ticket t ON t.TicketId = te.TicketId');
    
    -- Now make it NOT NULL and add FK
    ALTER TABLE altdesk.TicketEvent ALTER COLUMN TenantId UNIQUEIDENTIFIER NOT NULL;
    ALTER TABLE altdesk.TicketEvent ADD CONSTRAINT FK_TicketEvent_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId);
END
GO
