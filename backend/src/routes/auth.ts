import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { signToken, verifyPassword, assertTenantActive } from "../auth.js";
import { validateBody } from "../middleware/validateMw.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { writeAuditLog } from "../services/auditLog.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Zod Schema for Login
const LoginSchema = z.object({
    tenantId: z.string().uuid().optional(),
    email: z.string().email(),
    password: z.string().min(6)
});

// POST /api/auth/login
router.post("/login", authLimiter, validateBody(LoginSchema), async (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers["user-agent"]?.substring(0, 200);
    const requestId = (req as any).requestId;

    try {
        const body = req.body as z.infer<typeof LoginSchema>;
        const pool = await getPool();
        let r;

        if (body.tenantId) {
            r = await pool.request()
                .input("tenantId", body.tenantId)
                .input("email", body.email)
                .query(`
          SELECT TOP 1 UserId, TenantId, Role, PasswordHash, IsActive, DisplayName, Position, PermissionsJson
          FROM altdesk.[User]
          WHERE TenantId=@tenantId AND Email=@email AND DeletedAt IS NULL
        `);
        } else {
            r = await pool.request()
                .input("email", body.email)
                .query(`
          SELECT TOP 1 UserId, TenantId, Role, PasswordHash, IsActive, DisplayName, Position, PermissionsJson
          FROM altdesk.[User]
          WHERE Email=@email AND DeletedAt IS NULL
        `);
        }

        // Usuário não encontrado
        if (r.recordset.length === 0) {
            logger.warn({ requestId, email: body.email, ip }, "Login failed: user not found");
            await writeAuditLog({
                action: "LOGIN_FAILED",
                ipAddress: ip,
                userAgent,
                afterValues: { email: body.email, reason: "user_not_found" }
            });
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        const u = r.recordset[0];

        // Usuário inativo
        if (!u.IsActive) {
            logger.warn({ requestId, userId: u.UserId, email: body.email, ip }, "Login failed: user inactive");
            await writeAuditLog({
                tenantId: u.TenantId,
                userId: u.UserId,
                action: "LOGIN_FAILED",
                ipAddress: ip,
                userAgent,
                afterValues: { email: body.email, reason: "user_inactive" }
            });
            return res.status(403).json({ error: "Usuário inativo" });
        }

        // Tenant inativo
        if (u.Role !== 'SUPERADMIN') {
            try {
                await assertTenantActive(u.TenantId);
            } catch (e: any) {
                logger.warn({ requestId, userId: u.UserId, tenantId: u.TenantId, ip }, "Login failed: tenant inactive");
                return res.status(403).json({ error: e.message });
            }
        }

        // Senha incorreta
        const ok = await verifyPassword(body.password, Buffer.from(u.PasswordHash));
        if (!ok) {
            logger.warn({ requestId, userId: u.UserId, email: body.email, ip, role: u.Role }, "Login failed: wrong password");
            await writeAuditLog({
                tenantId: u.TenantId,
                userId: u.UserId,
                action: "LOGIN_FAILED",
                ipAddress: ip,
                userAgent,
                afterValues: { email: body.email, reason: "wrong_password" }
            });
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        // Parse Permissions
        let permissions = {
            dashboard: true,
            chat: true,
            tickets: true,
            contacts: true,
            reports: true,
            billing: false,
            users: false,
            settings: true
        };

        if (u.PermissionsJson) {
            try {
                permissions = { ...permissions, ...JSON.parse(u.PermissionsJson) };
            } catch (e) {
                logger.error({ userId: u.UserId }, "Failed to parse PermissionsJson");
            }
        } else if (u.Role === 'ADMIN' || u.Role === 'SUPERADMIN') {
            // Default full access for admins if no special config exists
            permissions.billing = true;
            permissions.users = true;
        }

        // Login bem-sucedido
        const token = signToken({ 
            userId: u.UserId, 
            tenantId: u.TenantId, 
            role: u.Role, 
            displayName: u.DisplayName,
            position: u.Position,
            permissions
        });

        logger.info({ requestId, userId: u.UserId, tenantId: u.TenantId, role: u.Role, email: body.email, ip }, "Login success");
        await writeAuditLog({
            tenantId: u.TenantId,
            userId: u.UserId,
            action: "LOGIN_SUCCESS",
            ipAddress: ip,
            userAgent,
            afterValues: { email: body.email, role: u.Role }
        });

        return res.json({ token, role: u.Role, tenantId: u.TenantId, permissions });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers["user-agent"]?.substring(0, 200);
    
    // If the user was authenticated, log who it was
    const user = (req as any).user;
    if (user) {
        await writeAuditLog({
            tenantId: user.tenantId,
            userId: user.userId,
            action: "LOGOUT",
            ipAddress: ip,
            userAgent
        });
    }
    
    res.json({ ok: true });
});

export default router;
