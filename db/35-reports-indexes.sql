-- Indexes for Ticket Table Reports performance
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Ticket_Tenant_Deleted_SlaStatus' AND object_id = OBJECT_ID('altdesk.Ticket'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Ticket_Tenant_Deleted_SlaStatus 
    ON altdesk.Ticket (TenantId, DeletedAt) 
    INCLUDE (SlaStatus, CreatedAt, Priority, Status, AssignedAgentId, ResolvedAt, FirstResponseAt);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Ticket_Tenant_Deleted_CreatedAt' AND object_id = OBJECT_ID('altdesk.Ticket'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Ticket_Tenant_Deleted_CreatedAt 
    ON altdesk.Ticket (TenantId, DeletedAt, CreatedAt DESC)
    INCLUDE (Status, Priority, SlaStatus, AssignedAgentId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Ticket_Tenant_Deleted_Status_Priority' AND object_id = OBJECT_ID('altdesk.Ticket'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Ticket_Tenant_Deleted_Status_Priority 
    ON altdesk.Ticket (TenantId, DeletedAt, Status, Priority);
END
GO

-- Indexes for Conversation Table Reports performance
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Conversation_Tenant_Deleted_SourceChannel' AND object_id = OBJECT_ID('altdesk.Conversation'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Conversation_Tenant_Deleted_SourceChannel
    ON altdesk.Conversation (TenantId, DeletedAt, SourceChannel)
    INCLUDE (CreatedAt, Status, AssignedUserId, ChannelId, QueueId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Conversation_Tenant_Deleted_CreatedAt' AND object_id = OBJECT_ID('altdesk.Conversation'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Conversation_Tenant_Deleted_CreatedAt
    ON altdesk.Conversation (TenantId, DeletedAt, CreatedAt DESC)
    INCLUDE (Status, SourceChannel, AssignedUserId, ChannelId, QueueId);
END
GO
