/**
 * Billing Controller — Endpoints HTTP de billing do AltDesk.
 * 
 * Rotas autenticadas para gestão de assinaturas e faturas,
 * mais o endpoint público de webhook do Asaas.
 */
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../../middleware/validateMw.js";
import { authMw } from "../../mw.js";
import * as billingService from "./billing.service.js";
import { processWebhookEvent } from "./providers/asaas/asaas.webhook.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// ─── WEBHOOK (Público — chamado pelo Asaas) ─────────────────


router.post("/webhooks/asaas", (async (req: any, res: any) => {
    // 1. Validar token do webhook
    const webhookToken = req.header("asaas-access-token");
    if (webhookToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
        logger.warn({ receivedToken: webhookToken?.substring(0, 8) }, "[Billing Webhook] Invalid token");
        return res.status(401).json({ error: "Invalid webhook token" });
    }

    // 2. Responder 200 rápido (Asaas requirement)
    res.status(200).json({ ok: true });

    // 3. Processar assincronamente
    try {
        await processWebhookEvent(req.body);
    } catch (err) {
        logger.error({ err }, "[Billing Webhook] Processing error");
    }
}) as any);

// ─── AUTHENTICATED ROUTES ───────────────────────────────────

// Listar planos disponíveis
router.get("/plans", authMw, (async (req: any, res: any, next: any) => {
    try {
        const plans = await billingService.listPlans();
        res.json(plans);
    } catch (err) { next(err); }
}) as any);

// Status da assinatura do tenant atual
router.get("/subscription", authMw, (async (req: any, res: any, next: any) => {
    try {
        const sub = await billingService.getSubscriptionStatus(req.user.tenantId);
        res.json(sub || { Status: "none" });
    } catch (err) { next(err); }
}) as any);

// Listar faturas do tenant
router.get("/invoices", authMw, (async (req: any, res: any, next: any) => {
    try {
        const invoices = await billingService.listInvoices(req.user.tenantId);
        res.json(invoices);
    } catch (err) { next(err); }
}) as any);

// Criar cliente de billing (Admin only)
router.post("/customer", authMw, validateBody(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    mobilePhone: z.string().optional(),
    cpfCnpj: z.string().optional(),
})), (async (req: any, res: any, next: any) => {
    try {
        if (req.user.role !== "ADMIN" && req.user.role !== "SUPERADMIN") {
            return res.status(403).json({ error: "Sem permissão" });
        }
        const customer = await billingService.ensureBillingCustomer(req.user.tenantId, req.body);
        res.json(customer);
    } catch (err) { next(err); }
}) as any);

// Criar assinatura (Admin only)
router.post("/subscribe", authMw, validateBody(z.object({
    planCode: z.string(),
    billingType: z.enum(["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED"]).optional(),
})), (async (req: any, res: any, next: any) => {
    try {
        if (req.user.role !== "ADMIN" && req.user.role !== "SUPERADMIN") {
            return res.status(403).json({ error: "Sem permissão" });
        }
        const sub = await billingService.createBillingSubscription(
            req.user.tenantId,
            req.body.planCode,
            req.body.billingType || "UNDEFINED"
        );
        res.json(sub);
    } catch (err) { next(err); }
}) as any);

// Cancelar assinatura (Admin only)
router.delete("/subscription", authMw, (async (req: any, res: any, next: any) => {
    try {
        if (req.user.role !== "ADMIN" && req.user.role !== "SUPERADMIN") {
            return res.status(403).json({ error: "Sem permissão" });
        }
        await billingService.cancelBillingSubscription(req.user.tenantId);
        res.json({ ok: true, message: "Assinatura cancelada." });
    } catch (err) { next(err); }
}) as any);

export default router;
