/**
 * Billing Service — Lógica de negócio de faturamento do AltDesk.
 * 
 * Abstrai o provedor (Asaas) e fornece funções de alto nível para:
 * - Criar/sincronizar cliente de billing
 * - Criar assinatura
 * - Cancelar assinatura
 * - Consultar status e faturas
 * - Bloquear/liberar acesso por inadimplência
 */
import { getPool } from "../../db.js";
import { logger } from "../../lib/logger.js";
import * as asaas from "./providers/asaas/asaas.client.js";
import { toCents, fromCents } from "./providers/asaas/asaas.mapper.js";

// ─── CUSTOMER ────────────────────────────────────────────────

/**
 * Cria ou retorna o cliente de billing para um tenant.
 */
export async function ensureBillingCustomer(tenantId: string, data: {
    name: string;
    email?: string;
    mobilePhone?: string;
    cpfCnpj?: string;
}) {
    const pool = await getPool();

    // Check if already exists
    const existing = await pool.request()
        .input("tenantId", tenantId)
        .input("provider", "asaas")
        .query("SELECT * FROM altdesk.BillingCustomer WHERE TenantId = @tenantId AND Provider = @provider");

    if (existing.recordset.length > 0) {
        return existing.recordset[0];
    }

    // Create in Asaas
    const customer = await asaas.createCustomer(data);

    // Save locally
    await pool.request()
        .input("tenantId", tenantId)
        .input("provider", "asaas")
        .input("providerCustomerId", customer.id)
        .input("name", data.name)
        .input("email", data.email || null)
        .input("mobilePhone", data.mobilePhone || null)
        .input("cpfCnpj", data.cpfCnpj || null)
        .query(`
            INSERT INTO altdesk.BillingCustomer
                (TenantId, Provider, ProviderCustomerId, Name, Email, MobilePhone, CpfCnpj)
            VALUES
                (@tenantId, @provider, @providerCustomerId, @name, @email, @mobilePhone, @cpfCnpj)
        `);

    logger.info({ tenantId, asaasCustomerId: customer.id }, "[Billing] Customer created in Asaas");
    return { ...data, ProviderCustomerId: customer.id };
}

// ─── SUBSCRIPTION ────────────────────────────────────────────

/**
 * Cria uma assinatura para o tenant no Asaas.
 */
export async function createBillingSubscription(tenantId: string, planCode: string, billingType: string = "UNDEFINED") {
    const pool = await getPool();

    // 1. Get plan
    const planResult = await pool.request()
        .input("code", planCode)
        .query("SELECT * FROM altdesk.BillingPlan WHERE Code = @code AND IsActive = 1");

    const plan = planResult.recordset[0];
    if (!plan) throw new Error(`Plano '${planCode}' não encontrado.`);

    // 2. Get billing customer
    const custResult = await pool.request()
        .input("tenantId", tenantId)
        .input("provider", "asaas")
        .query("SELECT ProviderCustomerId FROM altdesk.BillingCustomer WHERE TenantId = @tenantId AND Provider = @provider");

    const providerCustomerId = custResult.recordset[0]?.ProviderCustomerId;
    if (!providerCustomerId) throw new Error("Cliente de billing não encontrado. Crie o cliente antes.");

    // 3. Calculate next due date (today + 1 month for first billing)
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 30);
    const nextDueDate = nextDue.toISOString().split("T")[0];

    // 4. Create in Asaas
    const cyclMap: Record<string, string> = { monthly: "MONTHLY", quarterly: "QUARTERLY", yearly: "YEARLY" };
    const sub = await asaas.createSubscription({
        customer: providerCustomerId,
        billingType,
        value: fromCents(plan.PriceCents),
        nextDueDate,
        cycle: cyclMap[plan.Cycle] || "MONTHLY",
        description: `AltDesk - Plano ${plan.Name}`,
    });

    // 5. Save locally
    await pool.request()
        .input("tenantId", tenantId)
        .input("planId", plan.PlanId)
        .input("provider", "asaas")
        .input("providerSubId", sub.id)
        .input("providerCustId", providerCustomerId)
        .input("status", "pending_activation")
        .input("paymentMethod", billingType)
        .input("valueCents", plan.PriceCents)
        .input("nextDueDate", nextDueDate)
        .query(`
            INSERT INTO altdesk.BillingSubscription
                (TenantId, PlanId, Provider, ProviderSubscriptionId, ProviderCustomerId,
                 Status, PaymentMethod, ValueCents, NextDueDate, StartedAt)
            VALUES
                (@tenantId, @planId, @provider, @providerSubId, @providerCustId,
                 @status, @paymentMethod, @valueCents, @nextDueDate, SYSUTCDATETIME())
        `);

    logger.info({ tenantId, subscriptionId: sub.id, plan: planCode }, "[Billing] Subscription created");
    return sub;
}

/**
 * Cancela a assinatura ativa do tenant.
 */
export async function cancelBillingSubscription(tenantId: string) {
    const pool = await getPool();

    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("provider", "asaas")
        .query(`
            SELECT ProviderSubscriptionId, BillingSubscriptionId
            FROM altdesk.BillingSubscription
            WHERE TenantId = @tenantId AND Provider = @provider AND Status NOT IN ('canceled', 'suspended')
        `);

    const sub = result.recordset[0];
    if (!sub) throw new Error("Nenhuma assinatura ativa encontrada.");

    // Cancel in Asaas
    await asaas.cancelSubscription(sub.ProviderSubscriptionId);

    // Update locally
    await pool.request()
        .input("id", sub.BillingSubscriptionId)
        .query(`
            UPDATE altdesk.BillingSubscription
            SET Status = 'canceled', CanceledAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
            WHERE BillingSubscriptionId = @id
        `);

    logger.info({ tenantId, subscriptionId: sub.ProviderSubscriptionId }, "[Billing] Subscription canceled");
}

// ─── QUERIES ────────────────────────────────────────────────

/**
 * Retorna o status atual da assinatura de um tenant.
 */
export async function getSubscriptionStatus(tenantId: string) {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT bs.*, bp.Code AS PlanCode, bp.Name AS PlanName
            FROM altdesk.BillingSubscription bs
            JOIN altdesk.BillingPlan bp ON bp.PlanId = bs.PlanId
            WHERE bs.TenantId = @tenantId AND bs.Provider = 'asaas'
            ORDER BY bs.CreatedAt DESC
        `);
    return result.recordset[0] || null;
}

/**
 * Lista as faturas de um tenant.
 */
export async function listInvoices(tenantId: string) {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT * FROM altdesk.BillingInvoice
            WHERE TenantId = @tenantId AND Provider = 'asaas'
            ORDER BY CreatedAt DESC
        `);
    return result.recordset;
}

/**
 * Lista os planos disponíveis.
 */
export async function listPlans() {
    const pool = await getPool();
    const result = await pool.request()
        .query("SELECT * FROM altdesk.BillingPlan WHERE IsActive = 1 ORDER BY PriceCents");
    return result.recordset;
}
