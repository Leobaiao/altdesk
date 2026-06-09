import { Router } from "express";
import { getPool } from "../db.js";
import { authMw, requireRole, requirePermission } from "../mw.js";

const router = Router();

/**
 * GET /api/audit
 * Lista os logs de auditoria do tenant atual. 
 * Apenas ADMIN ou SUPERADMIN.
 */
router.get("/", authMw, requirePermission('settings'), requireRole("ADMIN", "SUPERADMIN"), async (req: any, res) => {
    try {
        const pool = await getPool();
        const tenantId = req.user.tenantId;

        const search = req.query.search as string;
        const reqDb = pool.request().input("tenantId", tenantId);
        
        let searchWhere = "";
        if (search) {
            reqDb.input("search", `%${search}%`);
            searchWhere = ` AND (al.Action LIKE @search OR u.DisplayName LIKE @search OR u.Email LIKE @search OR al.TargetTable LIKE @search OR al.TargetId LIKE @search)`;
        }

        const r = await reqDb.query(`
                SELECT TOP 100 
                       al.*, 
                       u.Email as UserEmail,
                       u.DisplayName as UserName
                FROM altdesk.AuditLog al
                LEFT JOIN altdesk.[User] u ON u.UserId = al.UserId
                WHERE al.TenantId = @tenantId
                ${searchWhere}
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
router.get("/admin/all", authMw, requirePermission('settings'), requireRole("SUPERADMIN"), async (req, res) => {
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
