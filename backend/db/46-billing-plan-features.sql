USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- Add FeaturesJson column to BillingPlan
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('altdesk.BillingPlan') AND name = 'FeaturesJson'
)
BEGIN
    ALTER TABLE altdesk.BillingPlan ADD FeaturesJson NVARCHAR(MAX) NULL;
END
GO
