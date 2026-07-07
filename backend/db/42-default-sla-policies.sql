USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- Create SLA Policies for existing Tenants if they don't have any
INSERT INTO altdesk.SLAPolicy (TenantId, Priority, FirstResponseMinutes, ResolutionMinutes, WarningBeforeMinutes, BusinessHoursOnly)
SELECT t.TenantId, 'LOW', 240, 1440, 10, 0
FROM altdesk.Tenant t
WHERE NOT EXISTS (SELECT 1 FROM altdesk.SLAPolicy WHERE TenantId = t.TenantId AND Priority = 'LOW');

INSERT INTO altdesk.SLAPolicy (TenantId, Priority, FirstResponseMinutes, ResolutionMinutes, WarningBeforeMinutes, BusinessHoursOnly)
SELECT t.TenantId, 'MEDIUM', 120, 480, 10, 0
FROM altdesk.Tenant t
WHERE NOT EXISTS (SELECT 1 FROM altdesk.SLAPolicy WHERE TenantId = t.TenantId AND Priority = 'MEDIUM');

INSERT INTO altdesk.SLAPolicy (TenantId, Priority, FirstResponseMinutes, ResolutionMinutes, WarningBeforeMinutes, BusinessHoursOnly)
SELECT t.TenantId, 'HIGH', 60, 240, 10, 0
FROM altdesk.Tenant t
WHERE NOT EXISTS (SELECT 1 FROM altdesk.SLAPolicy WHERE TenantId = t.TenantId AND Priority = 'HIGH');

INSERT INTO altdesk.SLAPolicy (TenantId, Priority, FirstResponseMinutes, ResolutionMinutes, WarningBeforeMinutes, BusinessHoursOnly)
SELECT t.TenantId, 'CRITICAL', 30, 120, 10, 0
FROM altdesk.Tenant t
WHERE NOT EXISTS (SELECT 1 FROM altdesk.SLAPolicy WHERE TenantId = t.TenantId AND Priority = 'CRITICAL');
GO
