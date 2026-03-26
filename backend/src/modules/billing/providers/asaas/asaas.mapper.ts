/**
 * Asaas Mapper — Converte tipos do Asaas para o modelo interno do AltDesk.
 */

/**
 * Mapeia o status de pagamento do Asaas para o status de assinatura do AltDesk.
 */
export function mapPaymentStatusToSubscriptionStatus(asaasPaymentStatus: string): string {
    const map: Record<string, string> = {
        "PENDING": "pending_activation",
        "RECEIVED": "active",
        "CONFIRMED": "active",
        "OVERDUE": "past_due",
        "REFUNDED": "canceled",
        "RECEIVED_IN_CASH": "active",
        "REFUND_REQUESTED": "active",
        "REFUND_IN_PROGRESS": "active",
        "CHARGEBACK_REQUESTED": "suspended",
        "CHARGEBACK_DISPUTE": "suspended",
        "AWAITING_CHARGEBACK_REVERSAL": "suspended",
        "DUNNING_REQUESTED": "past_due",
        "DUNNING_RECEIVED": "active",
        "AWAITING_RISK_ANALYSIS": "pending_activation",
    };
    return map[asaasPaymentStatus] || "pending_activation";
}

/**
 * Mapeia o status de pagamento do Asaas para o status da invoice local.
 */
export function mapPaymentStatusToInvoiceStatus(asaasPaymentStatus: string): string {
    const map: Record<string, string> = {
        "PENDING": "pending",
        "RECEIVED": "received",
        "CONFIRMED": "confirmed",
        "OVERDUE": "overdue",
        "REFUNDED": "refunded",
        "RECEIVED_IN_CASH": "received",
        "REFUND_REQUESTED": "received",
        "REFUND_IN_PROGRESS": "received",
        "CHARGEBACK_REQUESTED": "pending",
        "CHARGEBACK_DISPUTE": "pending",
        "AWAITING_CHARGEBACK_REVERSAL": "pending",
        "DUNNING_REQUESTED": "overdue",
        "DUNNING_RECEIVED": "received",
        "AWAITING_RISK_ANALYSIS": "pending",
    };
    return map[asaasPaymentStatus] || "pending";
}

/**
 * Converte o event type do webhook do Asaas para um nome mais limpo.
 */
export function normalizeWebhookEventType(event: string): string {
    // Asaas envia: PAYMENT_RECEIVED, PAYMENT_OVERDUE, etc.
    return event;
}

/**
 * Converte valor em reais (float) para centavos (int).
 */
export function toCents(value: number): number {
    return Math.round(value * 100);
}

/**
 * Converte centavos (int) para reais (float).
 */
export function fromCents(cents: number): number {
    return cents / 100;
}
