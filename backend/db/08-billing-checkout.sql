-- ============================================================
-- Migration 08: Billing Checkout Sessions (Asaas Checkout)
-- Rastreamento de sessões de checkout hospedado pelo Asaas.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BillingCheckout' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.BillingCheckout (
        CheckoutId          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId            UNIQUEIDENTIFIER NOT NULL,
        PlanId              UNIQUEIDENTIFIER NOT NULL,
        Provider            NVARCHAR(20)  NOT NULL DEFAULT 'asaas',
        ProviderCheckoutId  NVARCHAR(200) NOT NULL,       -- ID retornado pelo Asaas
        CheckoutLink        NVARCHAR(MAX) NOT NULL,        -- URL da página de checkout
        Status              NVARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
            -- ACTIVE, PAID, CANCELED, EXPIRED
        ExternalReference   NVARCHAR(200) NULL,
        ExpiresAt           DATETIME2     NULL,
        CreatedAt           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_BillingCheckout_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_BillingCheckout_Plan   FOREIGN KEY (PlanId)   REFERENCES altdesk.BillingPlan(PlanId),
        CONSTRAINT UQ_BillingCheckout_Provider UNIQUE (Provider, ProviderCheckoutId)
    );

    CREATE INDEX IX_BillingCheckout_Tenant_Status ON altdesk.BillingCheckout(TenantId, Status);
    CREATE INDEX IX_BillingCheckout_ExtRef ON altdesk.BillingCheckout(ExternalReference);
END
GO
