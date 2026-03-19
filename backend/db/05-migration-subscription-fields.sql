USE AltDeskDev;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Subscription') AND name = 'PlanCode')
BEGIN
    ALTER TABLE altdesk.Subscription ADD PlanCode NVARCHAR(50) NOT NULL DEFAULT 'TRIAL';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('altdesk.Subscription') AND name = 'StartsAt')
BEGIN
    ALTER TABLE altdesk.Subscription ADD StartsAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
END
GO

PRINT 'Subscription fields migration completed';
GO
