/**
 * Asaas API Client - AltDesk Billing Module
 * 
 * Client HTTP abstrato para a API v3 do Asaas.
 * Suporta sandbox e produção via variáveis de ambiente.
 * 
 * Ref: https://docs.asaas.com/reference
 */

const BASE_URL =
    process.env.ASAAS_ENV === "production"
        ? "https://api.asaas.com/v3"
        : "https://api-sandbox.asaas.com/v3";

const API_KEY = process.env.ASAAS_API_KEY || "";

interface AsaasRequestOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: Record<string, any>;
    params?: Record<string, string>;
}

/**
 * Executa uma requisição autenticada à API do Asaas.
 */
async function asaasRequest<T = any>(path: string, options: AsaasRequestOptions = {}): Promise<T> {
    const { method = "GET", body, params } = options;

    let url = `${BASE_URL}${path}`;
    if (params) {
        const qs = new URLSearchParams(params).toString();
        url += `?${qs}`;
    }

    const init: RequestInit = {
        method,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Altdesk/1.0",
            "access_token": API_KEY,
        },
    };

    if (body && (method === "POST" || method === "PUT")) {
        init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`[Asaas] ${response.status} ${response.statusText}: ${text}`);
    }

    return response.json() as Promise<T>;
}

// ─── CUSTOMERS ──────────────────────────────────────────────

export interface AsaasCustomer {
    id: string;
    name: string;
    email?: string;
    mobilePhone?: string;
    cpfCnpj?: string;
}

export async function createCustomer(data: {
    name: string;
    email?: string;
    mobilePhone?: string;
    cpfCnpj?: string;
}): Promise<AsaasCustomer> {
    return asaasRequest<AsaasCustomer>("/customers", { method: "POST", body: data });
}

export async function getCustomer(customerId: string): Promise<AsaasCustomer> {
    return asaasRequest<AsaasCustomer>(`/customers/${customerId}`);
}

export async function updateCustomer(customerId: string, data: Partial<AsaasCustomer>): Promise<AsaasCustomer> {
    return asaasRequest<AsaasCustomer>(`/customers/${customerId}`, { method: "PUT", body: data });
}

// ─── SUBSCRIPTIONS ──────────────────────────────────────────

export interface AsaasSubscription {
    id: string;
    customer: string;
    billingType: string;
    value: number;
    nextDueDate: string;
    cycle: string;
    status: string;
}

export async function createSubscription(data: {
    customer: string;
    billingType: string; // BOLETO, PIX, CREDIT_CARD, UNDEFINED
    value: number;
    nextDueDate: string; // YYYY-MM-DD
    cycle: string; // MONTHLY, QUARTERLY, YEARLY
    description?: string;
}): Promise<AsaasSubscription> {
    return asaasRequest<AsaasSubscription>("/subscriptions", { method: "POST", body: data });
}

export async function getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
    return asaasRequest<AsaasSubscription>(`/subscriptions/${subscriptionId}`);
}

export async function cancelSubscription(subscriptionId: string): Promise<any> {
    return asaasRequest(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

export async function listSubscriptionPayments(subscriptionId: string): Promise<{ data: AsaasPayment[] }> {
    return asaasRequest(`/subscriptions/${subscriptionId}/payments`);
}

// ─── PAYMENTS ───────────────────────────────────────────────

export interface AsaasPayment {
    id: string;
    subscription?: string;
    customer: string;
    billingType: string;
    value: number;
    netValue?: number;
    status: string;
    dueDate: string;
    paymentDate?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    pixQrCodeBase64?: string;
    pixCopiaECola?: string;
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
    return asaasRequest<AsaasPayment>(`/payments/${paymentId}`);
}

export async function getPaymentPixQrCode(paymentId: string): Promise<{ encodedImage: string; payload: string }> {
    return asaasRequest(`/payments/${paymentId}/pixQrCode`);
}

export async function getPaymentBankSlip(paymentId: string): Promise<{ identificationField: string; barCode: string }> {
    return asaasRequest(`/payments/${paymentId}/identificationField`);
}
