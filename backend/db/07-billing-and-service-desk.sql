-- ============================================================
-- Migration 07: Billing & Service Desk Tables
-- Integração Asaas + Modelo de Faturamento + Eventos de Ticket
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. BILLING PLANS (Planos comerciais do AltDesk)
-- ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BillingPlan' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.BillingPlan (
        PlanId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        Code NVARCHAR(50) NOT NULL UNIQUE,
        Name NVARCHAR(100) NOT NULL,
        PriceCents INT NOT NULL,
        Cycle NVARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly, quarterly, yearly
        AgentsSeatLimit INT NOT NULL DEFAULT 3,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- ──────────────────────────────────────────────────────────────
-- 2. BILLING CUSTOMERS (Espelho do cliente no Asaas)
-- ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BillingCustomer' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.BillingCustomer (
        BillingCustomerId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Provider NVARCHAR(20) NOT NULL DEFAULT 'asaas',
        ProviderCustomerId NVARCHAR(100) NOT NULL,
        Name NVARCHAR(150) NOT NULL,
        Email NVARCHAR(200) NULL,
        MobilePhone NVARCHAR(30) NULL,
        CpfCnpj NVARCHAR(20) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_BillingCustomer_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT UQ_BillingCustomer_Provider UNIQUE (Provider, ProviderCustomerId),
        CONSTRAINT UQ_BillingCustomer_Tenant UNIQUE (TenantId, Provider)
    );
END
GO

-- ──────────────────────────────────────────────────────────────
-- 3. BILLING SUBSCRIPTIONS (Contrato local vinculado ao Asaas)
-- ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BillingSubscription' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.BillingSubscription (
        BillingSubscriptionId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        PlanId UNIQUEIDENTIFIER NOT NULL,
        Provider NVARCHAR(20) NOT NULL DEFAULT 'asaas',
        ProviderSubscriptionId NVARCHAR(100) NOT NULL,
        ProviderCustomerId NVARCHAR(100) NOT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'trialing',
            -- trialing, pending_activation, active, past_due, grace_period, suspended, canceled
        PaymentMethod NVARCHAR(30) NULL, -- BOLETO, PIX, CREDIT_CARD, UNDEFINED
        ValueCents INT NOT NULL,
        NextDueDate DATE NULL,
        RemoteDeleted BIT NOT NULL DEFAULT 0,
        StartedAt DATETIME2 NULL,
        CanceledAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_BillingSub_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_BillingSub_Plan FOREIGN KEY (PlanId) REFERENCES altdesk.BillingPlan(PlanId),
        CONSTRAINT UQ_BillingSub_Provider UNIQUE (Provider, ProviderSubscriptionId)
    );
END
GO

-- ──────────────────────────────────────────────────────────────
-- 4. BILLING INVOICES (Cada cobrança gerada pelo Asaas)
-- ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BillingInvoice' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.BillingInvoice (
        BillingInvoiceId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        BillingSubscriptionId UNIQUEIDENTIFIER NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Provider NVARCHAR(20) NOT NULL DEFAULT 'asaas',
        ProviderPaymentId NVARCHAR(100) NOT NULL,
        ProviderSubscriptionId NVARCHAR(100) NULL,
        Status NVARCHAR(30) NOT NULL,
            -- pending, overdue, received, confirmed, refunded, deleted
        BillingType NVARCHAR(30) NULL, -- BOLETO, PIX, CREDIT_CARD, UNDEFINED
        ValueCents INT NOT NULL,
        NetValueCents INT NULL,
        DueDate DATE NULL,
        PaymentDate DATETIME2 NULL,
        InvoiceUrl NVARCHAR(MAX) NULL,
        BankSlipUrl NVARCHAR(MAX) NULL,
        PixQrCodePayload NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_BillingInv_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_BillingInv_Sub FOREIGN KEY (BillingSubscriptionId) REFERENCES altdesk.BillingSubscription(BillingSubscriptionId),
        CONSTRAINT UQ_BillingInv_Provider UNIQUE (Provider, ProviderPaymentId)
    );
END
GO

-- ──────────────────────────────────────────────────────────────
-- 5. BILLING WEBHOOK EVENTS (Idempotência e auditoria)
-- ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BillingWebhookEvent' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.BillingWebhookEvent (
        EventId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        Provider NVARCHAR(20) NOT NULL DEFAULT 'asaas',
        EventType NVARCHAR(100) NOT NULL,
        ProviderPaymentId NVARCHAR(100) NULL,
        PayloadJson NVARCHAR(MAX) NOT NULL,
        Processed BIT NOT NULL DEFAULT 0,
        ProcessedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_BillingWebhook_Provider_Event ON altdesk.BillingWebhookEvent(Provider, EventType, ProviderPaymentId);
END
GO

-- ──────────────────────────────────────────────────────────────
-- 6A. TICKET (Base para SLA e Service Desk - se não existir)
-- ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Ticket' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.Ticket (
        TicketId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        ConversationId UNIQUEIDENTIFIER NOT NULL,
        Priority NVARCHAR(20) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'OPEN',
        AssignedAgentId UNIQUEIDENTIFIER NULL,
        EscalationLevel INT NOT NULL DEFAULT 0,
        SLA_DueAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Ticket_Tenant FOREIGN KEY (TenantId) REFERENCES altdesk.Tenant(TenantId),
        CONSTRAINT FK_Ticket_Conversation FOREIGN KEY (ConversationId) REFERENCES altdesk.Conversation(ConversationId),
        CONSTRAINT FK_Ticket_AssignedAgent FOREIGN KEY (AssignedAgentId) REFERENCES altdesk.Agent(AgentId)
    );
    CREATE INDEX IX_Ticket_Tenant_Status ON altdesk.Ticket(TenantId, Status, Priority);
END
GO

-- ──────────────────────────────────────────────────────────────
-- 6B. TICKET EVENTS (Auditoria de mudanças no ticket)
-- ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TicketEvent' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.TicketEvent (
        EventId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        TicketId UNIQUEIDENTIFIER NOT NULL,
        EventType NVARCHAR(50) NOT NULL,
            -- status_change, assignment_change, priority_change, comment, escalation
        ActorUserId UNIQUEIDENTIFIER NULL,
        OldValue NVARCHAR(200) NULL,
        NewValue NVARCHAR(200) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_TicketEvent_Ticket FOREIGN KEY (TicketId) REFERENCES altdesk.Ticket(TicketId),
        CONSTRAINT FK_TicketEvent_User FOREIGN KEY (ActorUserId) REFERENCES altdesk.[User](UserId)
    );

    CREATE INDEX IX_TicketEvent_Ticket ON altdesk.TicketEvent(TicketId, CreatedAt DESC);
END
GO

-- ──────────────────────────────────────────────────────────────
-- 7. SEED: Planos padrão do AltDesk
-- ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM altdesk.BillingPlan WHERE Code = 'STARTER')
BEGIN
    INSERT INTO altdesk.BillingPlan (Code, Name, PriceCents, Cycle, AgentsSeatLimit) VALUES
        ('STARTER', 'Starter',    9900, 'monthly', 3),
        ('PRO',     'Profissional', 19900, 'monthly', 10),
        ('BUSINESS','Business',   49900, 'monthly', 30);
END
GO
