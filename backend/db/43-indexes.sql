USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Index for Messages query by Conversation
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Message_ConversationId_CreatedAt' AND object_id = OBJECT_ID('altdesk.Message'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Message_ConversationId_CreatedAt 
    ON altdesk.Message(ConversationId, CreatedAt);
END
GO

-- 2. Index for Tickets query by Conversation
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Ticket_ConversationId' AND object_id = OBJECT_ID('altdesk.Ticket'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Ticket_ConversationId 
    ON altdesk.Ticket(ConversationId);
END
GO

-- 3. Index for TicketEvents query by Ticket
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TicketEvent_TicketId_CreatedAt' AND object_id = OBJECT_ID('altdesk.TicketEvent'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TicketEvent_TicketId_CreatedAt 
    ON altdesk.TicketEvent(TicketId, CreatedAt);
END
GO

-- 4. Index for Conversations list query by Status/Tenant
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Conversation_TenantId_Status_CreatedAt' AND object_id = OBJECT_ID('altdesk.Conversation'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Conversation_TenantId_Status_CreatedAt 
    ON altdesk.Conversation(TenantId, Status, CreatedAt DESC);
END
GO
