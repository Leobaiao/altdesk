-- 41-performance-indexes.sql
-- Adiciona índices (B-Tree) recomendados para performance

-- Índices para altdesk.Ticket
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Ticket_Status_CreatedAt' AND object_id = OBJECT_ID('altdesk.Ticket'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Ticket_Status_CreatedAt 
    ON altdesk.Ticket (Status, CreatedAt)
    INCLUDE (TicketId, TenantId, AssignedUserId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Ticket_AssignedUserId' AND object_id = OBJECT_ID('altdesk.Ticket'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Ticket_AssignedUserId 
    ON altdesk.Ticket (AssignedUserId)
    INCLUDE (Status);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Ticket_SlaPolicyId' AND object_id = OBJECT_ID('altdesk.Ticket'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Ticket_SlaPolicyId 
    ON altdesk.Ticket (SlaPolicyId)
    WHERE SlaPolicyId IS NOT NULL;
END
GO

-- Índices para altdesk.Contact
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Contact_TenantId_Phone' AND object_id = OBJECT_ID('altdesk.Contact'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Contact_TenantId_Phone 
    ON altdesk.Contact (TenantId, Phone);
END
GO

-- Índices para altdesk.[User]
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_User_TenantId_Role' AND object_id = OBJECT_ID('altdesk.[User]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_User_TenantId_Role 
    ON altdesk.[User] (TenantId, Role, IsActive);
END
GO
