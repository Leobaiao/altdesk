import { Router } from "express";
import { getPool } from "../db.js";
import { authMw, requireRole } from "../mw.js";

const router = Router();

/**
 * GET /api/audit
 * Lista os logs de auditoria do tenant atual. 
 * Apenas ADMIN ou SUPERADMIN.
 */
router.get("/", authMw, requireRole("ADMIN", "SUPERADMIN"), async (req: any, res) => {
    try {
        const pool = await getPool();
        const tenantId = req.user.tenantId;

        const r = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                SELECT TOP 100 
                       al.*, 
                       u.Email as UserEmail,
                       u.DisplayName as UserName
                FROM altdesk.AuditLog al
                LEFT JOIN altdesk.[User] u ON u.UserId = al.UserId
                WHERE al.TenantId = @tenantId
                ORDER BY al.CreatedAt DESC
            `);

        res.json(r.recordset);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/audit/admin/all
 * Lista logs globais (Super Admin apenas).
 */
router.get("/admin/all", authMw, requireRole("SUPERADMIN"), async (req, res) => {
    try {
        const pool = await getPool();
        const r = await pool.request()
            .query(`
                SELECT TOP 200 
                       al.*, 
                       u.Email as UserEmail,
                       u.DisplayName as UserName,
                       t.Name as TenantName
                FROM altdesk.AuditLog al
                LEFT JOIN altdesk.[User] u ON u.UserId = al.UserId
                LEFT JOIN altdesk.Tenant t ON t.TenantId = al.TenantId
                ORDER BY al.CreatedAt DESC
            `);

        res.json(r.recordset);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
