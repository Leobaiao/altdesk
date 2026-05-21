USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- Indexes on Ticket table to optimize reports queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Ticket_Reports_Tenant_Deleted' AND object_id = OBJECT_ID('altdesk.Ticket'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Ticket_Reports_Tenant_Deleted
    ON altdesk.Ticket (TenantId, DeletedAt)
    INCLUDE (Status, Priority, SlaStatus, CreatedAt, ConversationId, AssignedAgentId);
END
GO

-- Indexes on Conversation table to optimize reports queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Conversation_Reports_Tenant_Deleted' AND object_id = OBJECT_ID('altdesk.Conversation'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Conversation_Reports_Tenant_Deleted
    ON altdesk.Conversation (TenantId, DeletedAt)
    INCLUDE (SourceChannel, CreatedAt, AssignedUserId, QueueId);
END
GO
