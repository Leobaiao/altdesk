import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { authMw, requireRole } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { writeAuditLog, extractRequestInfo } from "../services/auditLog.js";

const router = Router();
router.use(authMw, requireRole("ADMIN"));

// GET /api/roles - Lista todas as funções do tenant
router.get("/", async (req, res, next) => {
    try {
        const u = (req as any).user;
        const pool = await getPool();
        const r = await pool.request()
            .input("tenantId", u.tenantId)
            .query(`
                SELECT RoleId, Name, CanOpen, CanEscalate, CanClose, CanComment, HourlyValue, CreatedAt
                FROM altdesk.Role
                WHERE TenantId = @tenantId
                ORDER BY Name ASC
            `);
        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
});

// POST /api/roles - Criar nova função
router.post("/", validateBody(z.object({
    name: z.string().min(2),
    canOpen: z.boolean().default(true),
    canEscalate: z.boolean().default(false),
    canClose: z.boolean().default(false),
    canComment: z.boolean().default(true),
    hourlyValue: z.number().nullable().optional()
})), async (req, res, next) => {
    try {
        const u = (req as any).user;
        const body = req.body;
        const pool = await getPool();

        const r = await pool.request()
            .input("tenantId", u.tenantId)
            .input("name", body.name)
            .input("canOpen", body.canOpen ? 1 : 0)
            .input("canEscalate", body.canEscalate ? 1 : 0)
            .input("canClose", body.canClose ? 1 : 0)
            .input("canComment", body.canComment ? 1 : 0)
            .input("hourlyValue", body.hourlyValue ?? null)
            .query(`
                INSERT INTO altdesk.Role (TenantId, Name, CanOpen, CanEscalate, CanClose, CanComment, HourlyValue)
                OUTPUT inserted.RoleId
                VALUES (@tenantId, @name, @canOpen, @canEscalate, @canClose, @canComment, @hourlyValue)
            `);

        const roleId = r.recordset[0].RoleId;

        // Audit log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'CREATE_ROLE',
            targetTable: 'Role',
            targetId: roleId,
            afterValues: body
        });

        res.json({ ok: true, roleId });
    } catch (e: any) {
        if (e.code === 'EREQUEST' && e.message.includes('UK_Role_Name')) {
            return res.status(400).json({ error: "Já existe uma função com esse nome." });
        }
        next(e);
    }
});

// PUT /api/roles/:id - Atualizar função
router.put("/:id", validateBody(z.object({
    name: z.string().min(2),
    canOpen: z.boolean(),
    canEscalate: z.boolean(),
    canClose: z.boolean(),
    canComment: z.boolean(),
    hourlyValue: z.number().nullable().optional()
})), async (req, res, next) => {
    try {
        const u = (req as any).user;
        const body = req.body;
        const pool = await getPool();

        await pool.request()
            .input("roleId", req.params.id)
            .input("tenantId", u.tenantId)
            .input("name", body.name)
            .input("canOpen", body.canOpen ? 1 : 0)
            .input("canEscalate", body.canEscalate ? 1 : 0)
            .input("canClose", body.canClose ? 1 : 0)
            .input("canComment", body.canComment ? 1 : 0)
            .input("hourlyValue", body.hourlyValue ?? null)
            .query(`
                UPDATE altdesk.Role
                SET Name = @name, CanOpen = @canOpen, CanEscalate = @canEscalate,
                    CanClose = @canClose, CanComment = @canComment, HourlyValue = @hourlyValue
                WHERE RoleId = @roleId AND TenantId = @tenantId
            `);

        // Audit log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'UPDATE_ROLE',
            targetTable: 'Role',
            targetId: req.params.id,
            afterValues: body
        });

        res.json({ ok: true });
    } catch (e: any) {
        if (e.code === 'EREQUEST' && e.message.includes('UK_Role_Name')) {
            return res.status(400).json({ error: "Já existe uma função com esse nome." });
        }
        next(e);
    }
});

// DELETE /api/roles/:id - Excluir função
router.delete("/:id", async (req, res, next) => {
    try {
        const u = (req as any).user;
        const pool = await getPool();

        // Verificar se há usuários vinculados
        const check = await pool.request()
            .input("roleId", req.params.id)
            .input("tenantId", u.tenantId)
            .query("SELECT COUNT(*) as cnt FROM altdesk.[User] WHERE RoleId = @roleId AND TenantId = @tenantId");

        if (check.recordset[0].cnt > 0) {
            return res.status(400).json({ error: "Não é possível excluir: há usuários vinculados a esta função." });
        }

        await pool.request()
            .input("roleId", req.params.id)
            .input("tenantId", u.tenantId)
            .query("DELETE FROM altdesk.Role WHERE RoleId = @roleId AND TenantId = @tenantId");

        // Audit log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'DELETE_ROLE',
            targetTable: 'Role',
            targetId: req.params.id
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export default router;
