import { Router, Response, NextFunction } from "express";
import { authMw, requirePermission } from "../mw.js";
import { AuthenticatedRequest } from "../types/index.js";
import { parseReportFilters } from "../services/reportFilters.js";
import {
  getTicketsByStatusReport,
  getTicketsByPriorityReport,
  getTicketsByChannelReport,
  getAgentPerformanceReport,
  getSlaComplianceReport,
  getConversationsReport,
  getAgentsReport
} from "../services/reportService.js";
import {
  exportToCSV,
  exportToXLSX,
  exportToPDF
} from "../services/exportService.js";
import { getPool } from "../db.js";

/**
 * Retrieves the tenant company name for use in PDF export headers
 */
async function getTenantName(tenantId: string): Promise<string> {
  try {
    if (!tenantId) return "";
    const pool = await getPool();
    const result = await pool.request()
      .input("tid", tenantId)
      .query("SELECT Name FROM altdesk.Tenant WHERE TenantId = @tid");
    return result.recordset[0]?.Name || "";
  } catch {
    return "";
  }
}

const router = Router();
router.use(authMw);
router.use(requirePermission('reports'));

/**
 * Helper to process report requests and handle formatting (JSON, CSV, XLSX, PDF)
 */
async function handleReportRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  reportFn: (tenantId: string, filters: any) => Promise<any>,
  reportTitle: string
) {
  try {
    const tenantId = req.user.tenantId || "";
    const rawFormat = req.query.format;
    const format = (typeof rawFormat === "string" ? rawFormat : "json").toLowerCase();
    const filters = parseReportFilters(req.query);

    // If exporting, get all matching records without pagination limit
    if (format !== "json") {
      filters.limit = 1000000;
      filters.page = 1;
    }

    const data = await reportFn(tenantId, filters);

    if (format === "csv") {
      const csv = exportToCSV(data.details);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${reportTitle}_${Date.now()}.csv"`);
      return res.send(csv);
    }

    if (format === "xlsx") {
      const xlsx = await exportToXLSX(data.details);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${reportTitle}_${Date.now()}.xlsx"`);
      return res.send(xlsx);
    }

    if (format === "pdf") {
      const companyName = await getTenantName(tenantId);
      const pdf = await exportToPDF(data.details, reportTitle.replace(/_/g, " "), companyName);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${reportTitle}_${Date.now()}.pdf"`);
      return res.send(pdf);
    }

    return res.json(data);
  } catch (error) {
    next(error);
  }
}

/**
 * Universal export endpoint at /export
 */
router.get("/export", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user.tenantId || "";
    const rawReportType = req.query.reportType;
    const reportType = (typeof rawReportType === "string" ? rawReportType : "").toLowerCase();
    const rawFormat = req.query.format;
    const format = (typeof rawFormat === "string" ? rawFormat : "csv").toLowerCase();
    const filters = parseReportFilters(req.query);

    // Export gets all records matching criteria
    filters.limit = 1000000;
    filters.page = 1;

    let reportFn;
    let title = "Relatorio";

    switch (reportType) {
      case "status":
        reportFn = getTicketsByStatusReport;
        title = "Tickets_Por_Status";
        break;
      case "priority":
        reportFn = getTicketsByPriorityReport;
        title = "Tickets_Por_Prioridade";
        break;
      case "channel":
        reportFn = getTicketsByChannelReport;
        title = "Tickets_Por_Canal";
        break;
      case "agent-performance":
        reportFn = getAgentPerformanceReport;
        title = "Desempenho_De_Agentes";
        break;
      case "sla":
      case "sla-compliance":
        reportFn = getSlaComplianceReport;
        title = "Conformidade_SLA";
        break;
      case "conversations":
        reportFn = getConversationsReport;
        title = "Relatorio_De_Conversas";
        break;
      case "agents":
        reportFn = getAgentsReport;
        title = "Relatorio_De_Agentes";
        break;
      default:
        return res.status(400).json({ error: "Tipo de relatório inválido ou não especificado." });
    }

    const data = await reportFn(tenantId, filters);

    if (format === "csv") {
      const csv = exportToCSV(data.details);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${title}_${Date.now()}.csv"`);
      return res.send(csv);
    }

    if (format === "xlsx") {
      const xlsx = await exportToXLSX(data.details);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${title}_${Date.now()}.xlsx"`);
      return res.send(xlsx);
    }

    if (format === "pdf") {
      const companyName = await getTenantName(tenantId);
      const pdf = await exportToPDF(data.details, title.replace(/_/g, " "), companyName);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${title}_${Date.now()}.pdf"`);
      return res.send(pdf);
    }

    return res.status(400).json({ error: "Formato de exportação inválido. Use csv, xlsx ou pdf." });
  } catch (error) {
    next(error);
  }
}) as any);

router.get("/status", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await handleReportRequest(req, res, next, getTicketsByStatusReport, "Tickets_Por_Status");
}) as any);

router.get("/priority", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await handleReportRequest(req, res, next, getTicketsByPriorityReport, "Tickets_Por_Prioridade");
}) as any);

router.get("/channel", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await handleReportRequest(req, res, next, getTicketsByChannelReport, "Tickets_Por_Canal");
}) as any);

router.get("/agent-performance", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await handleReportRequest(req, res, next, getAgentPerformanceReport, "Desempenho_De_Agentes");
}) as any);

router.get("/sla-compliance", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await handleReportRequest(req, res, next, getSlaComplianceReport, "Conformidade_SLA");
}) as any);

// SLA compliance alias
router.get("/sla", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await handleReportRequest(req, res, next, getSlaComplianceReport, "Conformidade_SLA");
}) as any);

router.get("/conversations", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await handleReportRequest(req, res, next, getConversationsReport, "Relatorio_De_Conversas");
}) as any);

router.get("/agents", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await handleReportRequest(req, res, next, getAgentsReport, "Relatorio_De_Agentes");
}) as any);

export default router;
