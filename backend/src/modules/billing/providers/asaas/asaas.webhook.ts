/**
 * Asaas Webhook Handler
 * 
 * Processa eventos de pagamento do Asaas e atualiza o estado local
 * de assinaturas e faturas no AltDesk.
 */
import { getPool } from "../../../../db.js";
import { logger } from "../../../../lib/logger.js";
import { mapPaymentStatusToSubscriptionStatus, mapPaymentStatusToInvoiceStatus, toCents } from "./asaas.mapper.js";

export interface AsaasWebhookPayload {
    event: string;
    payment?: {
        id: string;
        customer: string;
        subscription?: string;
        billingType: string;
        value: number;
        netValue?: number;
        status: string;
        dueDate: string;
        paymentDate?: string;
        invoiceUrl?: string;
        bankSlipUrl?: string;
    };
}

/**
 * Processa um evento de webhook do Asaas.
 * Retorna true se processado, false se duplicado/ignorado.
 */
export async function processWebhookEvent(payload: AsaasWebhookPayload): Promise<boolean> {
    const pool = await getPool();
    const eventType = payload.event;
    const payment = payload.payment;
    const paymentId = payment?.id || null;

    // 1. Idempotência: verificar se já processamos este evento
    if (paymentId) {
        const existing = await pool.request()
            .input("provider", "asaas")
            .input("eventType", eventType)
            .input("paymentId", paymentId)
            .query(`
                SELECT EventId FROM altdesk.BillingWebhookEvent
                WHERE Provider = @provider AND EventType = @eventType AND ProviderPaymentId = @paymentId AND Processed = 1
            `);
        if (existing.recordset.length > 0) {
            logger.info({ eventType, paymentId }, "[Asaas Webhook] Duplicate event ignored");
            return false;
        }
    }

    // 2. Persistir o evento cru
    await pool.request()
        .input("provider", "asaas")
        .input("eventType", eventType)
        .input("paymentId", paymentId)
        .input("payload", JSON.stringify(payload))
        .query(`
            INSERT INTO altdesk.BillingWebhookEvent (Provider, EventType, ProviderPaymentId, PayloadJson)
            VALUES (@provider, @eventType, @paymentId, @payload)
        `);

    // 3. Processar o evento
    if (!payment) {
        logger.warn({ eventType }, "[Asaas Webhook] Event without payment data");
        return true;
    }

    try {
        switch (eventType) {
            case "PAYMENT_CREATED":
            case "PAYMENT_UPDATED":
                await upsertInvoice(pool, payment);
                break;

            case "PAYMENT_CONFIRMED":
            case "PAYMENT_RECEIVED":
                await upsertInvoice(pool, payment);
                if (payment.subscription) {
                    await updateSubscriptionStatus(pool, payment.subscription, "active");
                    const tenantId = await reactivateTenantIfSuspended(pool, payment.subscription);
                    
                    // Se o tenant for TRIAL, ativa a conta oficial e limpa dados demo
                    if (tenantId) {
                        const tenantResult = await pool.request()
                            .input("id", tenantId)
                            .query("SELECT AccountStatus FROM altdesk.Tenant WHERE TenantId = @id");
                        
                        if (tenantResult.recordset[0]?.AccountStatus === 'TRIAL') {
                            const { activateOfficialSubscription } = await import("../../../../services/subscriptionService.js");
                            await activateOfficialSubscription(tenantId);
                        }
                    }
                }
                break;

            case "PAYMENT_OVERDUE":
                await upsertInvoice(pool, payment);
                if (payment.subscription) {
                    await updateSubscriptionStatus(pool, payment.subscription, "past_due");
                }
                break;

            case "PAYMENT_REFUNDED":
                await upsertInvoice(pool, payment);
                break;

            case "PAYMENT_DELETED":
                await upsertInvoice(pool, payment);
                break;

            default:
                logger.info({ eventType }, "[Asaas Webhook] Unhandled event type");
        }

        // 4. Marcar como processado
        if (paymentId) {
            await pool.request()
                .input("provider", "asaas")
                .input("eventType", eventType)
                .input("paymentId", paymentId)
                .query(`
                    UPDATE altdesk.BillingWebhookEvent
                    SET Processed = 1, ProcessedAt = SYSUTCDATETIME()
                    WHERE Provider = @provider AND EventType = @eventType AND ProviderPaymentId = @paymentId
                `);
        }

        logger.info({ eventType, paymentId }, "[Asaas Webhook] Processed successfully");
        return true;

    } catch (err) {
        logger.error({ err, eventType, paymentId }, "[Asaas Webhook] Error processing event");
        throw err;
    }
}

// ─── HELPERS ─────────────────────────────────────────────────

async function upsertInvoice(pool: any, payment: NonNullable<AsaasWebhookPayload["payment"]>) {
    const status = mapPaymentStatusToInvoiceStatus(payment.status);

    // Check if invoice already exists
    const existing = await pool.request()
        .input("provider", "asaas")
        .input("paymentId", payment.id)
        .query("SELECT BillingInvoiceId FROM altdesk.BillingInvoice WHERE Provider = @provider AND ProviderPaymentId = @paymentId");

    if (existing.recordset.length > 0) {
        // UPDATE
        await pool.request()
            .input("provider", "asaas")
            .input("paymentId", payment.id)
            .input("status", status)
            .input("billingType", payment.billingType || null)
            .input("valueCents", toCents(payment.value))
            .input("netValueCents", payment.netValue ? toCents(payment.netValue) : null)
            .input("paymentDate", payment.paymentDate || null)
            .input("invoiceUrl", payment.invoiceUrl || null)
            .input("bankSlipUrl", payment.bankSlipUrl || null)
            .query(`
                UPDATE altdesk.BillingInvoice SET
                    Status = @status,
                    BillingType = @billingType,
                    ValueCents = @valueCents,
                    NetValueCents = @netValueCents,
                    PaymentDate = @paymentDate,
                    InvoiceUrl = @invoiceUrl,
                    BankSlipUrl = @bankSlipUrl,
                    UpdatedAt = SYSUTCDATETIME()
                WHERE Provider = @provider AND ProviderPaymentId = @paymentId
            `);
    } else {
        // INSERT — need to find subscriptionId and tenantId
        const subResult = payment.subscription
            ? await pool.request()
                .input("provider", "asaas")
                .input("subId", payment.subscription)
                .query("SELECT BillingSubscriptionId, TenantId FROM altdesk.BillingSubscription WHERE Provider = @provider AND ProviderSubscriptionId = @subId")
            : null;

        const sub = subResult?.recordset[0];

        // Find tenantId from BillingCustomer if not from subscription
        let tenantId = sub?.TenantId;
        if (!tenantId) {
            const custResult = await pool.request()
                .input("provider", "asaas")
                .input("customerId", payment.customer)
                .query("SELECT TenantId FROM altdesk.BillingCustomer WHERE Provider = @provider AND ProviderCustomerId = @customerId");
            tenantId = custResult.recordset[0]?.TenantId;
        }

        if (!tenantId) {
            logger.warn({ paymentId: payment.id, customer: payment.customer }, "[Asaas Webhook] Cannot find tenant for payment");
            return;
        }

        await pool.request()
            .input("subId", sub?.BillingSubscriptionId || null)
            .input("tenantId", tenantId)
            .input("provider", "asaas")
            .input("paymentId", payment.id)
            .input("providerSubId", payment.subscription || null)
            .input("status", status)
            .input("billingType", payment.billingType || null)
            .input("valueCents", toCents(payment.value))
            .input("netValueCents", payment.netValue ? toCents(payment.netValue) : null)
            .input("dueDate", payment.dueDate || null)
            .input("paymentDate", payment.paymentDate || null)
            .input("invoiceUrl", payment.invoiceUrl || null)
            .input("bankSlipUrl", payment.bankSlipUrl || null)
            .query(`
                INSERT INTO altdesk.BillingInvoice
                    (BillingSubscriptionId, TenantId, Provider, ProviderPaymentId, ProviderSubscriptionId,
                     Status, BillingType, ValueCents, NetValueCents, DueDate, PaymentDate, InvoiceUrl, BankSlipUrl)
                VALUES
                    (@subId, @tenantId, @provider, @paymentId, @providerSubId,
                     @status, @billingType, @valueCents, @netValueCents, @dueDate, @paymentDate, @invoiceUrl, @bankSlipUrl)
            `);
    }
}

async function updateSubscriptionStatus(pool: any, providerSubscriptionId: string, status: string) {
    await pool.request()
        .input("provider", "asaas")
        .input("subId", providerSubscriptionId)
        .input("status", status)
        .query(`
            UPDATE altdesk.BillingSubscription
            SET Status = @status, UpdatedAt = SYSUTCDATETIME()
            WHERE Provider = @provider AND ProviderSubscriptionId = @subId
        `);
}

async function reactivateTenantIfSuspended(pool: any, providerSubscriptionId: string): Promise<string | null> {
    // Find the tenant from the subscription
    const result = await pool.request()
        .input("provider", "asaas")
        .input("subId", providerSubscriptionId)
        .query("SELECT TenantId FROM altdesk.BillingSubscription WHERE Provider = @provider AND ProviderSubscriptionId = @subId");

    const tenantId = result.recordset[0]?.TenantId;
    if (!tenantId) return null;

    // Reactivate the old Subscription table entry if needed
    await pool.request()
        .input("tenantId", tenantId)
        .query(`
            UPDATE altdesk.Subscription SET IsActive = 1
            WHERE TenantId = @tenantId AND IsActive = 0
        `);
    
    return tenantId;
}
