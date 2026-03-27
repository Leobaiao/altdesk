import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { signToken, hashPassword } from "../auth.js";
import { validateBody } from "../middleware/validateMw.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { writeAuditLog } from "../services/auditLog.js";
import { logger } from "../lib/logger.js";

const router = Router();

const OnboardingSchema = z.object({
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
    preloadModel: z.enum(["empty", "basic", "demo"]).default("empty"),
});

// POST /api/onboarding — Rota pública (sem autenticação)
router.post("/", authLimiter, validateBody(OnboardingSchema), async (req, res, next) => {
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
            return res.status(409).json({ error: "E-mail já cadastrado. Faça login ou use outro e-mail." });
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

        logger.info(
            { tenantId, userId, preloadModel: body.preloadModel, ip },
            "Onboarding completed successfully"
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

        return res.status(201).json({
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
