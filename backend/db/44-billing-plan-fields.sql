USE AltDeskDev;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- Add new columns to BillingPlan
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('altdesk.BillingPlan') AND name = 'MonthlyPrice'
)
BEGIN
    ALTER TABLE altdesk.BillingPlan ADD MonthlyPrice DECIMAL(10, 2) NULL;
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('altdesk.BillingPlan') AND name = 'AnnualPrice'
)
BEGIN
    ALTER TABLE altdesk.BillingPlan ADD AnnualPrice DECIMAL(10, 2) NULL;
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('altdesk.BillingPlan') AND name = 'StripeProductId'
)
BEGIN
    ALTER TABLE altdesk.BillingPlan ADD StripeProductId NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('altdesk.BillingPlan') AND name = 'StripePriceId'
)
BEGIN
    ALTER TABLE altdesk.BillingPlan ADD StripePriceId NVARCHAR(100) NULL;
END
GO

-- Update existing plans with dummy values
UPDATE altdesk.BillingPlan
SET MonthlyPrice = 49.90, AnnualPrice = 499.00
WHERE PlanCode = 'STARTER';

UPDATE altdesk.BillingPlan
SET MonthlyPrice = 99.90, AnnualPrice = 999.00
WHERE PlanCode = 'PRO';

UPDATE altdesk.BillingPlan
SET MonthlyPrice = 199.90, AnnualPrice = 1999.00
WHERE PlanCode = 'ENTERPRISE';
GO
