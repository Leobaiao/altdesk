import { Router } from "express";
import { getPool } from "../db.js";
import { authMw } from "../mw.js";

const router = Router();
router.use(authMw);

/**
 * GET /api/dashboard/stats
 * Returns basic counters + advanced metrics for the tenant.
 */
router.get("/stats", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();
        const tenantId = user.tenantId;

        // ── Basic counters ────────────────────────────────────────
        const openRes = await pool.request()
            .input("tenantId", tenantId)
            .query("SELECT COUNT(*) as count FROM altdesk.Conversation WHERE TenantId=@tenantId AND DeletedAt IS NULL AND Status='OPEN'");

        const resolvedRes = await pool.request()
            .input("tenantId", tenantId)
            .query("SELECT COUNT(*) as count FROM altdesk.Conversation WHERE TenantId=@tenantId AND DeletedAt IS NULL AND Status='RESOLVED'");

        const queueRes = await pool.request()
            .input("tenantId", tenantId)
            .query("SELECT COUNT(*) as count FROM altdesk.Conversation WHERE TenantId=@tenantId AND DeletedAt IS NULL AND QueueId IS NOT NULL AND AssignedUserId IS NULL AND Status='OPEN'");

        const msgsRes = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                SELECT COUNT(*) as count
                FROM altdesk.Message
                WHERE TenantId=@tenantId
                  AND CreatedAt >= CAST(GETUTCDATE() AS DATE)
                  AND CreatedAt < CAST(DATEADD(day, 1, GETUTCDATE()) AS DATE)
            `);

        // ── Advanced metrics ──────────────────────────────────────

        // Tempo Médio de Primeira Resposta (TMR) — last 30 days
        const tmrRes = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                SELECT AVG(DATEDIFF(SECOND, CreatedAt, FirstResponseAt)) as avgSeconds
                FROM altdesk.Conversation
                WHERE TenantId = @tenantId
                  AND DeletedAt IS NULL
                  AND FirstResponseAt IS NOT NULL
                  AND CreatedAt >= DATEADD(day, -30, GETUTCDATE())
            `);

        // Tempo Médio de Resolução — last 30 days
        const resolutionRes = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                SELECT AVG(DATEDIFF(SECOND, CreatedAt, ClosedAt)) as avgSeconds
                FROM altdesk.Conversation
                WHERE TenantId = @tenantId
                  AND DeletedAt IS NULL
                  AND ClosedAt IS NOT NULL
                  AND CreatedAt >= DATEADD(day, -30, GETUTCDATE())
            `);

        // CSAT médio — last 30 days
        const csatRes = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                SELECT AVG(CAST(CsatScore AS FLOAT)) as avgCsat,
                       COUNT(CsatScore) as csatCount
                FROM altdesk.Conversation
                WHERE TenantId = @tenantId
                  AND DeletedAt IS NULL
                  AND CsatScore IS NOT NULL
                  AND CreatedAt >= DATEADD(day, -30, GETUTCDATE())
            `);

        // SLA compliance — last 30 days
        const slaRes = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                SELECT 
                    COUNT(CASE WHEN SlaStatus = 'MET' THEN 1 END) as met,
                    COUNT(CASE WHEN SlaStatus = 'VIOLATED' THEN 1 END) as violated,
                    COUNT(CASE WHEN SlaStatus IS NOT NULL THEN 1 END) as total
                FROM altdesk.Conversation
                WHERE TenantId = @tenantId
                  AND DeletedAt IS NULL
                  AND CreatedAt >= DATEADD(day, -30, GETUTCDATE())
            `);

        // Volume de mensagens por hora — últimas 24h
        const volumeRes = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                SELECT DATEPART(HOUR, CreatedAt) as hour, COUNT(*) as count
                FROM altdesk.Message
                WHERE TenantId = @tenantId
                  AND CreatedAt >= DATEADD(hour, -24, GETUTCDATE())
                GROUP BY DATEPART(HOUR, CreatedAt)
                ORDER BY DATEPART(HOUR, CreatedAt)
            `);

        // Volume de conversas por dia — últimos 7 dias
        const dailyVolumeRes = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                SELECT CAST(CreatedAt AS DATE) as day, COUNT(*) as count
                FROM altdesk.Conversation
                WHERE TenantId = @tenantId
                  AND DeletedAt IS NULL
                  AND CreatedAt >= DATEADD(day, -7, GETUTCDATE())
                GROUP BY CAST(CreatedAt AS DATE)
                ORDER BY CAST(CreatedAt AS DATE)
            `);

        // Build hourly volume array (0-23)
        const hourlyVolume = Array(24).fill(0);
        for (const row of volumeRes.recordset) {
            hourlyVolume[row.hour] = row.count;
        }

        // SLA compliance percentage
        const slaTotal = slaRes.recordset[0].total || 0;
        const slaMet = slaRes.recordset[0].met || 0;
        const slaCompliance = slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : null;

        res.json({
            // Basic
            open: openRes.recordset[0].count,
            resolved: resolvedRes.recordset[0].count,
            queue: queueRes.recordset[0].count,
            messagesToday: msgsRes.recordset[0].count,

            // Advanced
            avgFirstResponseSeconds: tmrRes.recordset[0].avgSeconds || null,
            avgResolutionSeconds: resolutionRes.recordset[0].avgSeconds || null,
            avgCsat: csatRes.recordset[0].avgCsat || null,
            csatCount: csatRes.recordset[0].csatCount || 0,
            slaCompliance,
            slaMet,
            slaViolated: slaRes.recordset[0].violated || 0,
            slaTotal,
            hourlyVolume,
            dailyVolume: dailyVolumeRes.recordset.map(r => ({
                day: r.day,
                count: r.count
            }))
        });
    } catch (error) {
        next(error);
    }
});

export default router;
