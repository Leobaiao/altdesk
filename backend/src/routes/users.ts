import { Router } from "express";
import { z } from "zod";
import sql from "mssql";
import { getPool } from "../db.js";
import { authMw, requireRole } from "../mw.js";
import { hashPassword } from "../auth.js";
import { validateBody } from "../middleware/validateMw.js";
import { writeAuditLog, extractRequestInfo } from "../services/auditLog.js";

const router = Router();
router.use(authMw);

// GET /api/users is accessible to AGENTs (e.g. for listing chat transfer targets)
router.get("/", async (req, res, next) => {
    try {
        const u = (req as any).user;
        const pool = await getPool();
        const r = await pool.request()
            .input("tenantId", u.tenantId)
            .query(`
        SELECT u.UserId, u.Email, u.Role, u.IsActive, a.Name as AgentName
        FROM altdesk.[User] u
        LEFT JOIN altdesk.Agent a ON a.UserId = u.UserId
        WHERE u.TenantId = @tenantId AND u.Role != 'SUPERADMIN'
        ORDER BY u.CreatedAt DESC
      `);
        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
});

// All routes below require ADMIN role
router.post("/", requireRole("ADMIN"), validateBody(z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["ADMIN", "AGENT"]).default("AGENT")
})), async (req, res, next) => {
    try {
        const u = (req as any).user;
        const body = req.body;

        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const hash = await hashPassword(body.password);
            const rUser = await transaction.request()
                .input("tenantId", u.tenantId)
                .input("email", body.email)
                .input("name", body.name)
                .input("hash", hash)
                .input("role", body.role)
                .query(`
          INSERT INTO altdesk.[User] (TenantId, Email, DisplayName, PasswordHash, Role)
          OUTPUT inserted.UserId
          VALUES (@tenantId, @email, @name, @hash, @role)
        `);
            const newUserId = rUser.recordset[0].UserId;

            await transaction.request()
                .input("tenantId", u.tenantId)
                .input("userId", newUserId)
                .input("name", body.name)
                .query(`
          INSERT INTO altdesk.Agent (TenantId, UserId, Kind, Name)
          VALUES (@tenantId, @userId, 'HUMAN', @name)
        `);

            await transaction.commit();

            // Audit log
            const reqInfo = extractRequestInfo(req);
            writeAuditLog({
                ...reqInfo,
                action: 'CREATE_USER',
                targetTable: 'User',
                targetId: newUserId,
                afterValues: { email: body.email, name: body.name, role: body.role }
            });

            res.json({ ok: true, userId: newUserId });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (e: any) {
        if (e.code === 'EREQUEST' && e.message.includes('UK_User_Email')) {
            return res.status(400).json({ error: "Email já cadastrado." });
        }
        next(e);
    }
});

router.put("/:id", requireRole("ADMIN"), validateBody(z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().optional(),
    role: z.enum(["ADMIN", "AGENT"])
})), async (req, res, next) => {
    try {
        const u = (req as any).user;
        const body = req.body;
        const pool = await getPool();

        // Prevent modifying SUPERADMINs
        const check = await pool.request()
            .input("id", req.params.id)
            .input("tenantId", u.tenantId)
            .query("SELECT Role FROM altdesk.[User] WHERE UserId=@id AND TenantId=@tenantId");

        if (check.recordset.length === 0) return res.status(404).json({ error: "User not found" });
        if (check.recordset[0].Role === 'SUPERADMIN') return res.status(403).json({ error: "Cannot modify SUPERADMIN accounts" });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            if (body.password) {
                const hash = await hashPassword(body.password);
                await transaction.request()
                    .input("tenantId", u.tenantId)
                    .input("id", req.params.id)
                    .input("email", body.email)
                    .input("role", body.role)
                    .input("hash", hash)
                    .query(`
                        UPDATE altdesk.[User] 
                        SET Email=@email, Role=@role, PasswordHash=@hash 
                        WHERE UserId=@id AND TenantId=@tenantId
                    `);
            } else {
                await transaction.request()
                    .input("tenantId", u.tenantId)
                    .input("id", req.params.id)
                    .input("email", body.email)
                    .input("role", body.role)
                    .query(`
                        UPDATE altdesk.[User] 
                        SET Email=@email, Role=@role 
                        WHERE UserId=@id AND TenantId=@tenantId
                    `);
            }

            await transaction.request()
                .input("tenantId", u.tenantId)
                .input("id", req.params.id)
                .input("name", body.name)
                .query(`
                    UPDATE altdesk.Agent 
                    SET Name=@name 
                    WHERE UserId=@id AND TenantId=@tenantId
                `);

            await transaction.commit();

            // Audit log
            const reqInfo = extractRequestInfo(req);
            writeAuditLog({
                ...reqInfo,
                action: 'UPDATE_USER',
                targetTable: 'User',
                targetId: req.params.id,
                afterValues: { email: body.email, name: body.name, role: body.role }
            });

            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (e: any) {
        if (e.code === 'EREQUEST' && e.message.includes('UK_User_Email')) {
            return res.status(400).json({ error: "Email já cadastrado por outro usuário." });
        }
        next(e);
    }
});

router.put("/:id/status", requireRole("ADMIN"), validateBody(z.object({ isActive: z.boolean() })), async (req, res, next) => {
    try {
        const u = (req as any).user;
        const userId = req.params.id;
        const { isActive } = req.body;
        const pool = await getPool();

        // Prevent modifying SUPERADMINs
        const check = await pool.request()
            .input("id", userId)
            .input("tenantId", u.tenantId)
            .query("SELECT Role FROM altdesk.[User] WHERE UserId=@id AND TenantId=@tenantId");

        if (check.recordset.length === 0) return res.status(404).json({ error: "User not found" });
        if (check.recordset[0].Role === 'SUPERADMIN') return res.status(403).json({ error: "Access denied" });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request()
                .input("id", userId)
                .input("tenantId", u.tenantId)
                .input("active", isActive ? 1 : 0)
                .query("UPDATE altdesk.[User] SET IsActive=@active WHERE UserId=@id AND TenantId=@tenantId");

            await transaction.request()
                .input("id", userId)
                .input("tenantId", u.tenantId)
                .input("active", isActive ? 1 : 0)
                .query("UPDATE altdesk.Agent SET IsActive=@active WHERE UserId=@id AND TenantId=@tenantId");

            await transaction.commit();

            // Audit log
            const reqInfo = extractRequestInfo(req);
            writeAuditLog({
                ...reqInfo,
                action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
                targetTable: 'User',
                targetId: userId,
                afterValues: { isActive }
            });

            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
});

export default router;
