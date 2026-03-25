import { Router, Response, NextFunction } from "express";
import { getPool } from "../db.js";
import { authMw } from "../mw.js";
import { AuthenticatedRequest } from "../types/index.js";

const router = Router();
router.use(authMw);

const HEADER_MAP: Record<string, string> = {
    ConversationId: "ID_Conversa",
    Status: "Situacao",
    SourceChannel: "Canal",
    CreatedAt: "Data_Criacao",
    LastMessageAt: "Ultima_Mensagem",
    AssignedAgent: "Atendente",
    QueueName: "Fila",
    MessageCount: "Total_Mensagens",
    SlaStatus: "SLA_Status",
    SlaDeadline: "SLA_Prazo",
    Agent: "Agente",
    Email: "Email",
    Resolved: "Resolvidos",
    Open: "Abertos",
    Total: "Total",
    SlaViolations: "SLA_Violacoes",
    SlaOk: "SLA_No_Prazo",
    SlaViolated: "SLA_Atrasados",
    SlaPending: "SLA_Pendentes",
    CompliancePercent: "Taxa_Sucesso_SLA_Pct"
};

function formatCSVDate(dateObj: any): string {
    if (!(dateObj instanceof Date)) return String(dateObj);
    if (isNaN(dateObj.getTime())) return "";
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${p(dateObj.getDate())}/${p(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${p(dateObj.getHours())}:${p(dateObj.getMinutes())}:${p(dateObj.getSeconds())}`;
}

// Helper: convert recordset to CSV string
function toCSV(rows: any[]): string {
    if (!rows.length) return "";
    const originalHeaders = Object.keys(rows[0]);
    const translatedHeaders = originalHeaders.map(h => HEADER_MAP[h] || h);

    const lines = [
        translatedHeaders.join(","),
        ...rows.map(row =>
            originalHeaders.map(h => {
                const v = row[h];
                if (v === null || v === undefined) return "";
                let str = "";
                if (v instanceof Date) {
                    str = formatCSVDate(v);
                } else {
                    str = String(v).replace(/"/g, '""');
                }
                return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
            }).join(",")
        )
    ];
    return lines.join("\r\n");
}

/**
 * GET /api/reports/conversations
 * Export conversations as CSV with optional filters
 */
router.get("/conversations", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const { from, to, status, format = "json" } = req.query as Record<string, string>;
        const pool = await getPool();
        const request = pool.request().input("tenantId", user.tenantId);

        let where = "WHERE c.TenantId = @tenantId";
        if (status) {
            where += " AND c.Status = @status";
            request.input("status", status);
        }
        if (from) {
            where += " AND c.CreatedAt >= @from";
            request.input("from", new Date(from));
        }
        if (to) {
            where += " AND c.CreatedAt <= @to";
            request.input("to", new Date(to));
        }

        const r = await request.query(`
            SELECT
                c.ConversationId,
                c.Status,
                c.SourceChannel,
                c.CreatedAt,
                c.LastMessageAt,
                u.DisplayName AS AssignedAgent,
                q.Name AS QueueName,
                (SELECT COUNT(*) FROM altdesk.Message m WHERE m.ConversationId = c.ConversationId) AS MessageCount,
                c.SlaStatus,
                c.SlaDeadline
            FROM altdesk.Conversation c
            LEFT JOIN altdesk.[User] u ON u.UserId = c.AssignedUserId
            LEFT JOIN altdesk.Queue q ON q.QueueId = c.QueueId
            ${where}
            ORDER BY c.CreatedAt DESC
        `);

        if (format === "csv") {
            const csv = toCSV(r.recordset);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="conversations_${Date.now()}.csv"`);
            return res.send("\uFEFF" + csv); // BOM para Excel aceitar UTF-8
        }

        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
}) as any);

/**
 * GET /api/reports/agents
 * Agent productivity report (closed conversations, avg response time)
 */
router.get("/agents", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const { from, to, format = "json" } = req.query as Record<string, string>;
        const pool = await getPool();
        const request = pool.request().input("tenantId", user.tenantId);

        let dateWhere = "";
        if (from) { dateWhere += " AND c.CreatedAt >= @from"; request.input("from", new Date(from)); }
        if (to) { dateWhere += " AND c.CreatedAt <= @to"; request.input("to", new Date(to)); }

        const r = await request.query(`
            SELECT
                u.DisplayName AS Agent,
                u.Email,
                COUNT(CASE WHEN c.Status = 'RESOLVED' THEN 1 END) AS Resolved,
                COUNT(CASE WHEN c.Status = 'OPEN' THEN 1 END) AS Open,
                COUNT(*) AS Total,
                COUNT(CASE WHEN c.SlaStatus = 'VIOLATED' THEN 1 END) AS SlaViolations
            FROM altdesk.[User] u
            LEFT JOIN altdesk.Conversation c ON c.AssignedUserId = u.UserId
                AND c.TenantId = @tenantId ${dateWhere}
            WHERE u.TenantId = @tenantId AND u.IsActive = 1
            GROUP BY u.UserId, u.DisplayName, u.Email
            ORDER BY Resolved DESC
        `);

        if (format === "csv") {
            const csv = toCSV(r.recordset);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="agents_report_${Date.now()}.csv"`);
            return res.send("\uFEFF" + csv);
        }

        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
}) as any);

/**
 * GET /api/reports/sla
 * SLA violations and compliance report
 */
router.get("/sla", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        const { from, to, format = "json" } = req.query as Record<string, string>;
        const pool = await getPool();
        const request = pool.request().input("tenantId", user.tenantId);

        let where = "WHERE c.TenantId = @tenantId";
        if (from) { where += " AND c.CreatedAt >= @from"; request.input("from", new Date(from)); }
        if (to) { where += " AND c.CreatedAt <= @to"; request.input("to", new Date(to)); }

        const r = await request.query(`
            SELECT
                COUNT(*) AS Total,
                COUNT(CASE WHEN c.SlaStatus = 'OK' THEN 1 END) AS SlaOk,
                COUNT(CASE WHEN c.SlaStatus = 'VIOLATED' THEN 1 END) AS SlaViolated,
                COUNT(CASE WHEN c.SlaStatus = 'PENDING' THEN 1 END) AS SlaPending,
                CAST(
                    100.0 * COUNT(CASE WHEN c.SlaStatus = 'OK' THEN 1 END) / NULLIF(COUNT(*), 0)
                AS DECIMAL(5,2)) AS CompliancePercent
            FROM altdesk.Conversation c
            ${where}
        `);

        if (format === "csv") {
            const csv = toCSV(r.recordset);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="sla_report_${Date.now()}.csv"`);
            return res.send("\uFEFF" + csv);
        }

        res.json(r.recordset[0] || {});
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
