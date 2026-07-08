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
        const dbCust = existing.recordset[0];
        
        // Update customer in Asaas to ensure it has the latest CPF/CNPJ
        await asaas.updateCustomer(dbCust.ProviderCustomerId, data);

        // Update local DB
        await pool.request()
            .input("id", dbCust.BillingCustomerId)
            .input("name", data.name)
            .input("email", data.email || null)
            .input("mobilePhone", data.mobilePhone || null)
            .input("cpfCnpj", data.cpfCnpj || null)
            .query(`
                UPDATE altdesk.BillingCustomer
                SET Name = @name, Email = @email, MobilePhone = @mobilePhone, CpfCnpj = @cpfCnpj
                WHERE BillingCustomerId = @id
            `);

        return { ...dbCust, ProviderCustomerId: dbCust.ProviderCustomerId };
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

export interface SubscriptionResult {
    subscription: asaas.AsaasSubscription;
    firstPayment?: asaas.AsaasPayment | null;
    pixQrCode?: { encodedImage: string; payload: string; expirationDate: string } | null;
}

/**
 * Cria uma assinatura para o tenant no Asaas.
 * Retorna a assinatura + primeira fatura (com QR Code Pix se aplicável).
 */
export async function createBillingSubscription(tenantId: string, planCode: string, billingType: string = "UNDEFINED"): Promise<SubscriptionResult> {
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

    // 3. Calculate next due date (today for immediate first charge)
    const today = new Date();
    const nextDueDate = today.toISOString().split("T")[0];

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

    // 6. Fetch the first payment generated by the subscription
    let firstPayment: asaas.AsaasPayment | null = null;
    let pixQrCode: { encodedImage: string; payload: string; expirationDate: string } | null = null;

    try {
        const payments = await asaas.listSubscriptionPayments(sub.id);
        if (payments.data && payments.data.length > 0) {
            firstPayment = payments.data[0];

            // If PIX, fetch the QR Code
            if (billingType === "PIX" && firstPayment) {
                try {
                    pixQrCode = await asaas.getPaymentPixQrCode(firstPayment.id);
                } catch (pixErr) {
                    logger.warn({ err: pixErr, paymentId: firstPayment.id }, "[Billing] Failed to fetch Pix QR code");
                }
            }
        }
    } catch (err) {
        logger.warn({ err, subscriptionId: sub.id }, "[Billing] Failed to fetch first payment after subscription creation");
    }

    return { subscription: sub, firstPayment, pixQrCode };
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
            SELECT 
                t.AccountStatus,
                bs.BillingSubscriptionId,
                bs.Status,
                bs.PaymentMethod,
                bs.ValueCents,
                bs.NextDueDate,
                bp.Code AS PlanCode,
                bp.Name AS PlanName
            FROM altdesk.Tenant t
            LEFT JOIN altdesk.BillingSubscription bs ON bs.TenantId = t.TenantId AND bs.Provider = 'asaas' AND bs.Status <> 'canceled'
            LEFT JOIN altdesk.BillingPlan bp ON bp.PlanId = bs.PlanId
            WHERE t.TenantId = @tenantId
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
