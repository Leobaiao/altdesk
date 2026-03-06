import { Router } from "express";
import { getPool } from "../db.js";
import { authMw } from "../mw.js";

const router = Router();
router.use(authMw);

router.get("/stats", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();

        const openRes = await pool.request()
            .input("tenantId", user.tenantId)
            .query("SELECT COUNT(*) as count FROM omni.Conversation WHERE TenantId=@tenantId AND Status='OPEN'");

        const resolvedRes = await pool.request()
            .input("tenantId", user.tenantId)
            .query("SELECT COUNT(*) as count FROM omni.Conversation WHERE TenantId=@tenantId AND Status='RESOLVED'");

        const queueRes = await pool.request()
            .input("tenantId", user.tenantId)
            .query("SELECT COUNT(*) as count FROM omni.Conversation WHERE TenantId=@tenantId AND QueueId IS NOT NULL AND AssignedUserId IS NULL AND Status='OPEN'");

        const msgsRes = await pool.request()
            .input("tenantId", user.tenantId)
            .query(`
        SELECT COUNT(*) as count 
        FROM omni.Message 
        WHERE TenantId=@tenantId 
        AND CreatedAt >= CAST(GETDATE() AS DATE) 
        AND CreatedAt < CAST(DATEADD(day, 1, GETDATE()) AS DATE)
      `);

        res.json({
            open: openRes.recordset[0].count,
            resolved: resolvedRes.recordset[0].count,
            queue: queueRes.recordset[0].count,
            messagesToday: msgsRes.recordset[0].count
        });
    } catch (error) {
        next(error);
    }
});

export default router;
