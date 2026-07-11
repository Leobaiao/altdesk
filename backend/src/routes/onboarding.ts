import { Router, Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { signToken, hashPassword } from "../auth.js";
import { validateBody } from "../middleware/validateMw.js";
import { onboardingLimiter } from "../middleware/rateLimiter.js";
import { writeAuditLog } from "../services/auditLog.js";
import { logger } from "../lib/logger.js";
import { preloadDemoData } from "../services/demoDataService.js";

const router = Router();

// Store SSE connections
const sseClients = new Map<string, Response>();

const OnboardingSchema = z.object({
    trackingId: z.string().optional(),
    companyName: z.string().min(2, "Nome da empresa é obrigatório"),
    tradeName: z.string().optional().default(""),
    cpfCnpj: z.string().optional().default(""),
    email: z.string().email("E-mail da empresa inválido"),
    phone: z.string().optional().default(""),
    adminName: z.string().min(2, "Nome do admin é obrigatório"),
    adminEmail: z.string().email("E-mail do admin inválido"),
    adminPhone: z.string().optional().default(""),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    timezone: z.string().optional().default("America/Sao_Paulo"),
    locale: z.string().optional().default("pt-BR"),
    preloadModel: z.enum(["empty", "basic", "demo", "large"]).default("empty"),
});

// GET /api/onboarding/events/:trackingId — SSE endpoint
router.get("/events/:trackingId", (req, res) => {
    const trackingId = req.params.trackingId;
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    
    sseClients.set(trackingId, res);
    
    req.on("close", () => {
        sseClients.delete(trackingId);
    });
});

// POST /api/onboarding — Rota pública (sem autenticação)
router.post("/", onboardingLimiter, validateBody(OnboardingSchema), async (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers["user-agent"]?.substring(0, 200);

    try {
        const body = req.body as z.infer<typeof OnboardingSchema>;
        const pool = await getPool();

        // 1. Verificar e-mail único
        const existing = await pool.request()
            .input("email", body.adminEmail)
            .query(`SELECT TOP 1 UserId FROM altdesk.[User] WHERE Email = @email`);

        if (existing.recordset.length > 0) {
            return res.status(409).json({ error: "Este e-mail de administrador já está em uso." });
        }

        // 1b. Verificar e-mail de empresa único
        const existingTenant = await pool.request()
            .input("tenantEmail", body.email)
            .query(`SELECT TOP 1 TenantId FROM altdesk.Tenant WHERE Email = @tenantEmail`);

        if (existingTenant.recordset.length > 0) {
            return res.status(409).json({ error: "Já existe uma empresa cadastrada com este e-mail." });
        }

        // 2. Hash da senha
        const passwordHash = await hashPassword(body.password);

        // 3. Executar procedure de onboarding
        const result = await pool.request()
            .input("company_name", body.companyName)
            .input("trade_name", body.tradeName)
            .input("cpf_cnpj", body.cpfCnpj)
            .input("email", body.email)
            .input("phone", body.phone)
            .input("admin_name", body.adminName)
            .input("admin_email", body.adminEmail)
            .input("admin_phone", body.adminPhone)
            .input("admin_password_hash", passwordHash)
            .input("timezone", body.timezone)
            .input("locale", body.locale)
            .input("preload_model", body.preloadModel)
            .execute("sp_altdesk_create_onboarding");

        const row = result.recordset[0];
        if (!row || !row.TenantId || !row.UserId) {
            throw new Error("Procedure sp_altdesk_create_onboarding não retornou TenantId/UserId");
        }

        const tenantId = row.TenantId;
        const userId = row.UserId;

        // 4. Gerar JWT
        const token = signToken({ userId, tenantId, role: "ADMIN" });

        // Helper para emitir SSE
        const emitProgress = (msg: string, pct: number) => {
            if (body.trackingId && sseClients.has(body.trackingId)) {
                const client = sseClients.get(body.trackingId)!;
                client.write(`data: ${JSON.stringify({ type: 'PROGRESS', message: msg, progress: pct })}\n\n`);
            }
        };

        const emitComplete = () => {
            if (body.trackingId && sseClients.has(body.trackingId)) {
                const client = sseClients.get(body.trackingId)!;
                client.write(`data: ${JSON.stringify({ type: 'COMPLETE', token, tenantId, role: "ADMIN", preloadModel: body.preloadModel })}\n\n`);
                client.end();
                sseClients.delete(body.trackingId);
            }
        };

        // 4b. Preload Data (if not empty) -> Assíncrono via SSE
        if (body.preloadModel !== "empty") {
            // Roda em background
            Promise.resolve().then(async () => {
                try {
                    await preloadDemoData(tenantId, body.preloadModel as "basic" | "demo" | "large", userId, (msg, pct) => {
                        emitProgress(msg, pct);
                    });
                    
                    logger.info(
                        { tenantId, userId, preloadModel: body.preloadModel, ip },
                        "Onboarding demo data completed successfully"
                    );

                    await writeAuditLog({
                        tenantId,
                        userId,
                        action: "ONBOARDING_COMPLETED",
                        ipAddress: ip,
                        userAgent,
                        afterValues: {
                            companyName: body.companyName,
                            adminEmail: body.adminEmail,
                            preloadModel: body.preloadModel,
                        },
                    });

                    emitComplete();
                } catch (err: any) {
                    logger.error({ tenantId, error: err.message }, "Failed to preload demo data async");
                    if (body.trackingId && sseClients.has(body.trackingId)) {
                        const client = sseClients.get(body.trackingId)!;
                        client.write(`data: ${JSON.stringify({ type: 'ERROR', message: "Falha na criação de dados de demonstração." })}\n\n`);
                        client.end();
                        sseClients.delete(body.trackingId);
                    }
                }
            });
        } else {
            // Se for empty, podemos finalizar de imediato também via SSE (caso frontend espere)
            Promise.resolve().then(async () => {
                await writeAuditLog({
                    tenantId,
                    userId,
                    action: "ONBOARDING_COMPLETED",
                    ipAddress: ip,
                    userAgent,
                    afterValues: {
                        companyName: body.companyName,
                        adminEmail: body.adminEmail,
                        preloadModel: body.preloadModel,
                    },
                });
                emitComplete();
            });
        }

        return res.status(201).json({
            status: "processing",
            token,
            tenantId,
            role: "ADMIN",
            preloadModel: body.preloadModel,
        });
    } catch (error: any) {
        logger.error({ error: error.message, ip }, "Onboarding failed");
        next(error);
    }
});

export default router;
