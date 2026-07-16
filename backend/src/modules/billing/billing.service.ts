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
        .query("SELECT * FROM altdesk.BillingPlan WHERE IsActive = 1");
        
    let plans = result.recordset.map(plan => {
        let features: string[] = [];
        try {
            if (plan.FeaturesJson) {
                features = JSON.parse(plan.FeaturesJson);
            }
        } catch (e) {}
        
        const mapped = { ...plan, Features: features, SummaryItems: [] as string[], Order: 99 };
        delete mapped.FeaturesJson;
        return mapped;
    });

    try {
        const configResult = await pool.request()
            .query("SELECT SettingValueJson FROM altdesk.SystemSetting WHERE SettingKey = 'pricing_config'");
            
        if (configResult.recordset.length > 0) {
            const config = JSON.parse(configResult.recordset[0].SettingValueJson);
            if (config && config.plans) {
                // Build order map from config array position
                const orderMap: Record<string, number> = {};
                config.plans.forEach((cp: any, idx: number) => {
                    orderMap[cp.id.toUpperCase()] = idx;
                });

                plans = plans.map(p => {
                    const matched = config.plans.find((cp: any) => cp.id.toUpperCase() === p.Code);
                    if (matched) {
                        return {
                            ...p,
                            Users: matched.users,
                            Contacts: matched.contacts,
                            AdditionalAgentPrice: matched.additionalAgentPrice,
                            AdditionalUsersPerAgent: matched.additionalUsersPerAgent,
                            SummaryItems: matched.summaryItems || [],
                            Features: matched.features || p.Features,
                            Order: orderMap[p.Code] ?? 99
                        };
                    }
                    return p;
                });
            }
        }
    } catch (err) {
        console.error("Erro ao mesclar config do plano:", err);
    }
    
    plans.sort((a, b) => a.Order - b.Order);

    return plans;
}

// ─── CHECKOUT (Asaas Checkout - Página hospedada) ────────────

/**
 * Busca dados do tenant e admin para pré-preencher o checkout.
 */
async function getTenantCustomerData(tenantId: string) {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT 
                t.Name AS CompanyName, t.TradeName, t.CpfCnpj, t.Phone,
                u.DisplayName AS AdminName, u.Email AS AdminEmail
            FROM altdesk.Tenant t
            LEFT JOIN altdesk.[User] u ON u.TenantId = t.TenantId AND u.Role = 'admin'
            WHERE t.TenantId = @tenantId
        `);
    return result.recordset[0] || null;
}

export interface CheckoutSessionResult {
    checkoutId: string;
    providerCheckoutId: string;
    link: string;
    expiresAt: string;
}

/**
 * Cria uma sessão de checkout hospedada pelo Asaas.
 * O pagador é redirecionado para a página do Asaas para completar o pagamento.
 */
export async function createCheckoutSession(tenantId: string, planCode: string): Promise<CheckoutSessionResult> {
    const pool = await getPool();

    // 1. Buscar plano
    const planResult = await pool.request()
        .input("code", planCode)
        .query("SELECT * FROM altdesk.BillingPlan WHERE Code = @code AND IsActive = 1");

    const plan = planResult.recordset[0];
    if (!plan) throw new Error(`Plano '${planCode}' não encontrado.`);

    // 2. Verificar se já existe checkout ativo para este tenant
    const existingCheckout = await pool.request()
        .input("tenantId", tenantId)
        .input("provider", "asaas")
        .query(`
            SELECT ProviderCheckoutId, CheckoutLink, Status
            FROM altdesk.BillingCheckout
            WHERE TenantId = @tenantId AND Provider = @provider AND Status = 'ACTIVE'
            ORDER BY CreatedAt DESC
        `);

    // Cancelar checkouts ativos anteriores
    for (const existing of existingCheckout.recordset) {
        try {
            await asaas.cancelCheckout(existing.ProviderCheckoutId);
        } catch (err) {
            logger.warn({ err, checkoutId: existing.ProviderCheckoutId }, "[Billing] Failed to cancel previous checkout");
        }
        await pool.request()
            .input("providerCheckoutId", existing.ProviderCheckoutId)
            .input("provider2", "asaas")
            .query(`
                UPDATE altdesk.BillingCheckout
                SET Status = 'CANCELED', UpdatedAt = SYSUTCDATETIME()
                WHERE Provider = @provider2 AND ProviderCheckoutId = @providerCheckoutId
            `);
    }

    // 3. Buscar dados do tenant para customerData
    const tenantData = await getTenantCustomerData(tenantId);

    // 4. Montar external reference
    const externalReference = `tenant-${tenantId}_plan-${planCode}`;

    // 5. Montar callback URLs
    const frontendUrl = process.env.FRONTEND_URL || "https://altdesk.com.br";
    
    // O Asaas Checkout recusa URLs com "localhost" ou "127.0.0.1". 
    // Precisamos mascarar para testes locais para não dar erro 400.
    const safeFrontendUrl = frontendUrl.includes("localhost") || frontendUrl.includes("127.0.0.1")
        ? "https://sandbox.altdesk.com.br" 
        : frontendUrl;
        
    const callbackBase = `${safeFrontendUrl}/billing`;

    // 6. Calcular expiração
    const minutesToExpire = 60;
    const expiresAt = new Date(Date.now() + minutesToExpire * 60 * 1000).toISOString();

    // 7. Montar cycle do Asaas
    const cycleMap: Record<string, "MONTHLY" | "QUARTERLY" | "YEARLY"> = { monthly: "MONTHLY", quarterly: "QUARTERLY", yearly: "YEARLY" };
    const asaasCycle = cycleMap[plan.Cycle] || "MONTHLY";

    // 8. Criar checkout no Asaas
    const checkout = await asaas.createCheckout({
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        minutesToExpire,
        externalReference,
        callback: {
            successUrl: `${callbackBase}?checkout=success`,
            cancelUrl: `${callbackBase}?checkout=cancel`,
            expiredUrl: `${callbackBase}?checkout=expired`,
        },
        subscription: {
            cycle: asaasCycle,
            value: fromCents(plan.PriceCents),
            description: `AltDesk - Plano ${plan.Name}`,
            nextDueDate: new Date().toISOString().split('T')[0],
        },
        items: [
            {
                externalReference: `plan-${planCode}`,
                name: `AltDesk ${plan.Name}`,
                description: `Assinatura mensal - até ${plan.AgentsSeatLimit} atendentes`,
                quantity: 1,
                value: fromCents(plan.PriceCents),
            },
        ],
        // customerData removido temporariamente para o usuário preencher na tela do Asaas,
        // pois a API do Asaas exige CPF, endereço completo, etc., se este campo for enviado.
    });

    const checkoutUrl = checkout.link;

    // 9. Salvar no banco
    const insertResult = await pool.request()
        .input("tenantId", tenantId)
        .input("planId", plan.PlanId)
        .input("provider", "asaas")
        .input("providerCheckoutId", checkout.id)
        .input("checkoutLink", checkoutUrl)
        .input("status", checkout.status || "ACTIVE")
        .input("externalReference", externalReference)
        .input("expiresAt", expiresAt)
        .query(`
            INSERT INTO altdesk.BillingCheckout
                (TenantId, PlanId, Provider, ProviderCheckoutId, CheckoutLink, Status, ExternalReference, ExpiresAt)
            OUTPUT INSERTED.CheckoutId
            VALUES
                (@tenantId, @planId, @provider, @providerCheckoutId, @checkoutLink, @status, @externalReference, @expiresAt)
        `);

    const checkoutId = insertResult.recordset[0].CheckoutId;

    logger.info({ tenantId, checkoutId: checkout.id, plan: planCode, link: checkoutUrl }, "[Billing] Checkout session created");

    return {
        checkoutId,
        providerCheckoutId: checkout.id,
        link: checkoutUrl,
        expiresAt,
    };
}

/**
 * Cancela uma sessão de checkout ativa.
 */
export async function cancelCheckoutSession(tenantId: string, checkoutId: string) {
    const pool = await getPool();

    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("checkoutId", checkoutId)
        .input("provider", "asaas")
        .query(`
            SELECT ProviderCheckoutId
            FROM altdesk.BillingCheckout
            WHERE CheckoutId = @checkoutId AND TenantId = @tenantId AND Provider = @provider AND Status = 'ACTIVE'
        `);

    const checkout = result.recordset[0];
    if (!checkout) throw new Error("Nenhum checkout ativo encontrado.");

    // Cancelar no Asaas
    await asaas.cancelCheckout(checkout.ProviderCheckoutId);

    // Atualizar localmente
    await pool.request()
        .input("checkoutId", checkoutId)
        .query(`
            UPDATE altdesk.BillingCheckout
            SET Status = 'CANCELED', UpdatedAt = SYSUTCDATETIME()
            WHERE CheckoutId = @checkoutId
        `);

    logger.info({ tenantId, checkoutId }, "[Billing] Checkout session canceled");
}
