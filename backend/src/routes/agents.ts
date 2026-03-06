import { Router } from "express";
import { z } from "zod";
import sql from "mssql";
import { getPool } from "../db.js";
import { authMw, requireRole } from "../mw.js";
import { hashPassword, assertAgentSeatAvailable } from "../auth.js";
import { validateBody } from "../middleware/validateMw.js";

const router = Router();
router.use(authMw, requireRole("ADMIN"));

router.post("/", validateBody(z.object({
    kind: z.enum(["HUMAN", "BOT"]),
    name: z.string().min(2),
    userId: z.string().uuid().nullable().optional()
})), async (req, res, next) => {
    try {
        const u = (req as any).user;
        const body = req.body;

        await assertAgentSeatAvailable(u.tenantId);

        const pool = await getPool();
        const r = await pool.request()
            .input("tenantId", u.tenantId)
            .input("kind", body.kind)
            .input("name", body.name)
            .input("userId", body.userId ?? null)
            .query(`
        INSERT INTO omni.Agent (TenantId, Kind, Name, UserId)
        OUTPUT inserted.AgentId
        VALUES (@tenantId, @kind, @name, @userId)
      `);

        res.json({ agentId: r.recordset[0].AgentId });
    } catch (error) {
        next(error);
    }
});

export default router;
