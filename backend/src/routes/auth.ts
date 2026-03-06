import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { signToken, verifyPassword, assertTenantActive } from "../auth.js";
import { validateBody } from "../middleware/validateMw.js";

const router = Router();

// Zod Schema for Login
const LoginSchema = z.object({
    tenantId: z.string().uuid().optional(),
    email: z.string().email(),
    password: z.string().min(6)
});

// POST /api/auth/login
router.post("/login", validateBody(LoginSchema), async (req, res, next) => {
    try {
        const body = req.body as z.infer<typeof LoginSchema>;
        const pool = await getPool();
        let r;

        if (body.tenantId) {
            r = await pool.request()
                .input("tenantId", body.tenantId)
                .input("email", body.email)
                .query(`
          SELECT TOP 1 UserId, TenantId, Role, PasswordHash, IsActive
          FROM omni.[User]
          WHERE TenantId=@tenantId AND Email=@email
        `);
        } else {
            r = await pool.request()
                .input("email", body.email)
                .query(`
          SELECT TOP 1 UserId, TenantId, Role, PasswordHash, IsActive
          FROM omni.[User]
          WHERE Email=@email
        `);
        }

        if (r.recordset.length === 0) return res.status(401).json({ error: "Credenciais inválidas" });
        const u = r.recordset[0];
        if (!u.IsActive) return res.status(403).json({ error: "Usuário inativo" });

        if (u.Role !== 'SUPERADMIN') {
            try {
                await assertTenantActive(u.TenantId);
            } catch (e: any) {
                return res.status(403).json({ error: e.message });
            }
        }

        const ok = await verifyPassword(body.password, Buffer.from(u.PasswordHash));
        if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

        const token = signToken({ userId: u.UserId, tenantId: u.TenantId, role: u.Role });
        return res.json({ token, role: u.Role, tenantId: u.TenantId });
    } catch (error) {
        next(error);
    }
});

export default router;
