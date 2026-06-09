import { getPool } from "../db.js";
import { ReportFilters, buildTicketWhereClause, buildConversationWhereClause } from "./reportFilters.js";

export interface ReportResult<T = any> {
  kpis: Record<string, any>;
  chartData: Array<{ label: string; [key: string]: any }>;
  details: T[];
  totalRows: number;
}

/**
 * 1. Tickets By Status Report
 */
export async function getTicketsByStatusReport(
  tenantId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const pool = await getPool();

  const reqKpis = pool.request();
  const ticketWhereKpis = buildTicketWhereClause(reqKpis, filters, tenantId, "t");
  const kpiResult = await reqKpis.query(`
    SELECT
      COUNT(*) AS TotalTickets,
      COUNT(CASE WHEN t.Status NOT IN ('RESOLVED', 'CLOSED') THEN 1 END) AS ActiveTickets,
      COUNT(CASE WHEN t.Status IN ('RESOLVED', 'CLOSED') THEN 1 END) AS ClosedTickets,
      COUNT(CASE WHEN t.SlaStatus = 'WARNING' THEN 1 END) AS SlaWarningTickets,
      COUNT(CASE WHEN t.SlaStatus = 'VIOLATED' THEN 1 END) AS SlaViolatedTickets
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    WHERE ${ticketWhereKpis}
  `);

  const reqChart = pool.request();
  const ticketWhereChart = buildTicketWhereClause(reqChart, filters, tenantId, "t");
  const chartResult = await reqChart.query(`
    SELECT
      CASE t.Status 
        WHEN 'NEW' THEN 'Novo'
        WHEN 'OPEN' THEN 'Aberto'
        WHEN 'TRIAGE' THEN 'Em Triagem'
        WHEN 'IN_PROGRESS' THEN 'Em Atendimento'
        WHEN 'WAITING_CUSTOMER' THEN 'Aguard. Cliente'
        WHEN 'WAITING_THIRD_PARTY' THEN 'Aguard. Terceiro'
        WHEN 'ESCALATED' THEN 'Escalado'
        WHEN 'RESOLVED' THEN 'Resolvido'
        WHEN 'CLOSED' THEN 'Fechado'
        ELSE t.Status END AS label,
      COUNT(*) AS value
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    WHERE ${ticketWhereChart}
    GROUP BY t.Status
    ORDER BY value DESC
  `);

  const reqDetails = pool.request();
  const ticketWhereDetails = buildTicketWhereClause(reqDetails, filters, tenantId, "t");
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;
  reqDetails.input("offset", offset);
  reqDetails.input("limit", limit);

  const detailsResult = await reqDetails.query(`
    SELECT
      t.TicketId,
      t.ConversationId,
      c.Title AS ConversationTitle,
      t.Status,
      t.Priority,
      t.SlaStatus,
      t.CreatedAt,
      u.DisplayName AS AgentName,
      COUNT(*) OVER() AS TotalRows
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    LEFT JOIN altdesk.Agent ag ON ag.AgentId = t.AssignedAgentId
    LEFT JOIN altdesk.[User] u ON u.UserId = ag.UserId
    WHERE ${ticketWhereDetails}
    ORDER BY t.CreatedAt DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `);

  const kpis = kpiResult.recordset[0] || {
    TotalTickets: 0,
    ActiveTickets: 0,
    ClosedTickets: 0,
    SlaWarningTickets: 0,
    SlaViolatedTickets: 0,
  };

  const details = detailsResult.recordset;
  const totalRows = details.length > 0 ? details[0].TotalRows : 0;

  return {
    kpis,
    chartData: chartResult.recordset,
    details,
    totalRows,
  };
}

/**
 * 2. Tickets By Priority Report
 */
export async function getTicketsByPriorityReport(
  tenantId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const pool = await getPool();

  const reqKpis = pool.request();
  const ticketWhereKpis = buildTicketWhereClause(reqKpis, filters, tenantId, "t");
  const kpiResult = await reqKpis.query(`
    SELECT
      COUNT(*) AS TotalTickets,
      COUNT(CASE WHEN t.Priority = 'CRITICAL' THEN 1 END) AS CriticalTickets,
      COUNT(CASE WHEN t.Priority = 'HIGH' THEN 1 END) AS HighTickets,
      COUNT(CASE WHEN t.Priority = 'MEDIUM' THEN 1 END) AS MediumTickets,
      COUNT(CASE WHEN t.Priority = 'LOW' THEN 1 END) AS LowTickets
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    WHERE ${ticketWhereKpis}
  `);

  const reqChart = pool.request();
  const ticketWhereChart = buildTicketWhereClause(reqChart, filters, tenantId, "t");
  const chartResult = await reqChart.query(`
    SELECT
      CASE t.Priority
        WHEN 'LOW' THEN 'Baixa'
        WHEN 'MEDIUM' THEN 'Média'
        WHEN 'HIGH' THEN 'Alta'
        WHEN 'CRITICAL' THEN 'Crítica'
        WHEN 'URGENT' THEN 'Urgente'
        ELSE t.Priority END AS label,
      COUNT(*) AS value
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    WHERE ${ticketWhereChart}
    GROUP BY t.Priority
    ORDER BY value DESC
  `);

  const reqDetails = pool.request();
  const ticketWhereDetails = buildTicketWhereClause(reqDetails, filters, tenantId, "t");
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;
  reqDetails.input("offset", offset);
  reqDetails.input("limit", limit);

  const detailsResult = await reqDetails.query(`
    SELECT
      t.TicketId,
      t.ConversationId,
      c.Title AS ConversationTitle,
      t.Status,
      t.Priority,
      t.SlaStatus,
      t.CreatedAt,
      u.DisplayName AS AgentName,
      COUNT(*) OVER() AS TotalRows
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    LEFT JOIN altdesk.Agent ag ON ag.AgentId = t.AssignedAgentId
    LEFT JOIN altdesk.[User] u ON u.UserId = ag.UserId
    WHERE ${ticketWhereDetails}
    ORDER BY t.CreatedAt DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `);

  const kpis = kpiResult.recordset[0] || {
    TotalTickets: 0,
    CriticalTickets: 0,
    HighTickets: 0,
    MediumTickets: 0,
    LowTickets: 0,
  };

  const details = detailsResult.recordset;
  const totalRows = details.length > 0 ? details[0].TotalRows : 0;

  return {
    kpis,
    chartData: chartResult.recordset,
    details,
    totalRows,
  };
}

/**
 * 3. Tickets By Channel Report
 */
export async function getTicketsByChannelReport(
  tenantId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const pool = await getPool();

  const reqKpis = pool.request();
  const ticketWhereKpis = buildTicketWhereClause(reqKpis, filters, tenantId, "t");
  const kpiResult = await reqKpis.query(`
    SELECT
      COUNT(*) AS TotalTickets,
      COUNT(CASE WHEN c.SourceChannel = 'WHATSAPP' THEN 1 END) AS WhatsappTickets,
      COUNT(CASE WHEN c.SourceChannel = 'EMAIL' THEN 1 END) AS EmailTickets,
      COUNT(CASE WHEN c.SourceChannel = 'PLATFORM' THEN 1 END) AS PlatformTickets,
      COUNT(CASE WHEN c.SourceChannel = 'SMS' THEN 1 END) AS SmsTickets,
      COUNT(CASE WHEN c.SourceChannel NOT IN ('WHATSAPP', 'EMAIL', 'PLATFORM', 'SMS') OR c.SourceChannel IS NULL THEN 1 END) AS OtherTickets
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    WHERE ${ticketWhereKpis}
  `);

  const reqChart = pool.request();
  const ticketWhereChart = buildTicketWhereClause(reqChart, filters, tenantId, "t");
  const chartResult = await reqChart.query(`
    SELECT
      COALESCE(ch.Name, c.SourceChannel, 'OUTROS') AS label,
      COUNT(*) AS value
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    LEFT JOIN altdesk.Channel ch ON ch.ChannelId = c.ChannelId AND ch.DeletedAt IS NULL
    WHERE ${ticketWhereChart}
    GROUP BY COALESCE(ch.Name, c.SourceChannel, 'OUTROS')
    ORDER BY value DESC
  `);

  const reqDetails = pool.request();
  const ticketWhereDetails = buildTicketWhereClause(reqDetails, filters, tenantId, "t");
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;
  reqDetails.input("offset", offset);
  reqDetails.input("limit", limit);

  const detailsResult = await reqDetails.query(`
    SELECT
      t.TicketId,
      t.ConversationId,
      c.Title AS ConversationTitle,
      COALESCE(ch.Name, c.SourceChannel, 'OUTROS') AS ChannelName,
      t.Status,
      t.Priority,
      t.SlaStatus,
      t.CreatedAt,
      u.DisplayName AS AgentName,
      COUNT(*) OVER() AS TotalRows
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    LEFT JOIN altdesk.Channel ch ON ch.ChannelId = c.ChannelId AND ch.DeletedAt IS NULL
    LEFT JOIN altdesk.Agent ag ON ag.AgentId = t.AssignedAgentId
    LEFT JOIN altdesk.[User] u ON u.UserId = ag.UserId
    WHERE ${ticketWhereDetails}
    ORDER BY t.CreatedAt DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `);

  const kpis = kpiResult.recordset[0] || {
    TotalTickets: 0,
    WhatsappTickets: 0,
    EmailTickets: 0,
    PlatformTickets: 0,
    SmsTickets: 0,
    OtherTickets: 0,
  };

  const details = detailsResult.recordset;
  const totalRows = details.length > 0 ? details[0].TotalRows : 0;

  return {
    kpis,
    chartData: chartResult.recordset,
    details,
    totalRows,
  };
}

/**
 * 4. Agent Performance Report
 */
export async function getAgentPerformanceReport(
  tenantId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const pool = await getPool();

  const reqKpis = pool.request();
  const ticketWhereKpis = buildTicketWhereClause(reqKpis, filters, tenantId, "t");
  const kpiResult = await reqKpis.query(`
    SELECT
      AVG(CAST(DATEDIFF(minute, t.CreatedAt, t.FirstResponseAt) AS FLOAT)) AS AvgFirstResponseTime,
      AVG(CAST(DATEDIFF(minute, t.CreatedAt, t.ResolvedAt) AS FLOAT)) AS AvgResolutionTime,
      COUNT(CASE WHEN t.Status = 'RESOLVED' THEN 1 END) AS ResolvedTickets,
      COUNT(CASE WHEN t.Status NOT IN ('RESOLVED', 'CLOSED') THEN 1 END) AS OpenTickets,
      CAST(100.0 * COUNT(CASE WHEN t.SlaStatus IN ('ON_TIME', 'WARNING') THEN 1 END) / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) AS SlaComplianceRate
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    WHERE ${ticketWhereKpis}
  `);

  const reqChart = pool.request();
  const ticketWhereChart = buildTicketWhereClause(reqChart, filters, tenantId, "t");
  const chartResult = await reqChart.query(`
    WITH AgentMetrics AS (
      SELECT
        t.AssignedAgentId,
        COUNT(CASE WHEN t.Status = 'RESOLVED' THEN 1 END) AS ResolvedCount,
        COUNT(CASE WHEN t.Status NOT IN ('RESOLVED', 'CLOSED') THEN 1 END) AS OpenCount
      FROM altdesk.Ticket t
      LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
      WHERE ${ticketWhereChart}
      GROUP BY t.AssignedAgentId
    )
    SELECT
      u.DisplayName AS label,
      COALESCE(m.ResolvedCount, 0) AS resolved,
      COALESCE(m.OpenCount, 0) AS openTickets
    FROM altdesk.Agent ag
    INNER JOIN altdesk.[User] u ON u.UserId = ag.UserId
    INNER JOIN AgentMetrics m ON m.AssignedAgentId = ag.AgentId
    WHERE ag.TenantId = @tenantId AND ag.IsActive = 1
    ORDER BY resolved DESC
  `);

  const reqDetails = pool.request();
  const ticketWhereDetails = buildTicketWhereClause(reqDetails, filters, tenantId, "t");
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;
  reqDetails.input("offset", offset);
  reqDetails.input("limit", limit);

  const detailsResult = await reqDetails.query(`
    WITH AgentMetrics AS (
      SELECT
        t.AssignedAgentId,
        COUNT(CASE WHEN t.Status = 'RESOLVED' THEN 1 END) AS ResolvedCount,
        COUNT(CASE WHEN t.Status NOT IN ('RESOLVED', 'CLOSED') THEN 1 END) AS OpenCount,
        COUNT(t.TicketId) AS TotalCount,
        CAST(100.0 * COUNT(CASE WHEN t.SlaStatus IN ('ON_TIME', 'WARNING') THEN 1 END) / NULLIF(COUNT(t.TicketId), 0) AS DECIMAL(5,2)) AS SlaComplianceRate,
        AVG(CAST(DATEDIFF(minute, t.CreatedAt, t.FirstResponseAt) AS FLOAT)) AS AvgFirstResponseTime,
        AVG(CAST(DATEDIFF(minute, t.CreatedAt, t.ResolvedAt) AS FLOAT)) AS AvgResolutionTime
      FROM altdesk.Ticket t
      LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
      WHERE ${ticketWhereDetails}
      GROUP BY t.AssignedAgentId
    )
    SELECT
      u.DisplayName AS AgentName,
      u.Email,
      COALESCE(m.ResolvedCount, 0) AS ResolvedCount,
      COALESCE(m.OpenCount, 0) AS OpenCount,
      COALESCE(m.TotalCount, 0) AS TotalCount,
      COALESCE(m.SlaComplianceRate, 100.0) AS SlaComplianceRate,
      COALESCE(m.AvgFirstResponseTime, 0) AS AvgFirstResponseTime,
      COALESCE(m.AvgResolutionTime, 0) AS AvgResolutionTime,
      COUNT(*) OVER() AS TotalRows
    FROM altdesk.Agent ag
    INNER JOIN altdesk.[User] u ON u.UserId = ag.UserId
    LEFT JOIN AgentMetrics m ON m.AssignedAgentId = ag.AgentId
    WHERE ag.TenantId = @tenantId AND ag.IsActive = 1
    ORDER BY ResolvedCount DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `);

  const kpis = kpiResult.recordset[0] || {
    AvgFirstResponseTime: 0,
    AvgResolutionTime: 0,
    ResolvedTickets: 0,
    OpenTickets: 0,
    SlaComplianceRate: 100.00,
  };

  const details = detailsResult.recordset;
  const totalRows = details.length > 0 ? details[0].TotalRows : 0;

  return {
    kpis,
    chartData: chartResult.recordset,
    details,
    totalRows,
  };
}

/**
 * 5. SLA Compliance Report
 */
export async function getSlaComplianceReport(
  tenantId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const pool = await getPool();

  const reqKpis = pool.request();
  const ticketWhereKpis = buildTicketWhereClause(reqKpis, filters, tenantId, "t");
  const kpiResult = await reqKpis.query(`
    SELECT
      COUNT(*) AS TotalTickets,
      COUNT(CASE WHEN t.SlaStatus = 'ON_TIME' THEN 1 END) AS SlaOnTime,
      COUNT(CASE WHEN t.SlaStatus = 'WARNING' THEN 1 END) AS SlaWarning,
      COUNT(CASE WHEN t.SlaStatus = 'VIOLATED' THEN 1 END) AS SlaViolated,
      CAST(100.0 * COUNT(CASE WHEN t.SlaStatus IN ('ON_TIME', 'WARNING') THEN 1 END) / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) AS ComplianceRate
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    WHERE ${ticketWhereKpis}
  `);

  const reqChart = pool.request();
  const ticketWhereChart = buildTicketWhereClause(reqChart, filters, tenantId, "t");
  const chartResult = await reqChart.query(`
    SELECT
      CASE t.SlaStatus
        WHEN 'ON_TIME' THEN 'No Prazo'
        WHEN 'OK' THEN 'No Prazo'
        WHEN 'WARNING' THEN 'Em Risco'
        WHEN 'VIOLATED' THEN 'Fora do SLA'
        WHEN 'BREACHED' THEN 'Fora do SLA'
        WHEN 'PENDING' THEN 'Pendente'
        ELSE t.SlaStatus END AS label,
      COUNT(*) AS value
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    WHERE ${ticketWhereChart}
    GROUP BY t.SlaStatus
    ORDER BY value DESC
  `);

  const reqDetails = pool.request();
  const ticketWhereDetails = buildTicketWhereClause(reqDetails, filters, tenantId, "t");
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;
  reqDetails.input("offset", offset);
  reqDetails.input("limit", limit);

  const detailsResult = await reqDetails.query(`
    SELECT
      t.TicketId,
      t.ConversationId,
      c.Title AS ConversationTitle,
      t.Status,
      t.Priority,
      t.SlaStatus,
      t.SlaPercentage,
      t.FirstResponseAt,
      t.ResolvedAt,
      t.CreatedAt,
      u.DisplayName AS AgentName,
      COUNT(*) OVER() AS TotalRows
    FROM altdesk.Ticket t
    LEFT JOIN altdesk.Conversation c ON c.ConversationId = t.ConversationId AND c.DeletedAt IS NULL
    LEFT JOIN altdesk.Agent ag ON ag.AgentId = t.AssignedAgentId
    LEFT JOIN altdesk.[User] u ON u.UserId = ag.UserId
    WHERE ${ticketWhereDetails}
    ORDER BY t.CreatedAt DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `);

  const kpis = kpiResult.recordset[0] || {
    TotalTickets: 0,
    SlaOnTime: 0,
    SlaWarning: 0,
    SlaViolated: 0,
    ComplianceRate: 100.00,
  };

  const details = detailsResult.recordset;
  const totalRows = details.length > 0 ? details[0].TotalRows : 0;

  return {
    kpis,
    chartData: chartResult.recordset,
    details,
    totalRows,
  };
}

/**
 * 6. Conversations Report (Extended)
 */
export async function getConversationsReport(
  tenantId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const pool = await getPool();

  const reqKpis = pool.request();
  const convWhereKpis = buildConversationWhereClause(reqKpis, filters, tenantId, "c");
  const kpiResult = await reqKpis.query(`
    WITH ConvMessageCounts AS (
      SELECT
        c.ConversationId,
        c.Status,
        c.CsatScore,
        (SELECT COUNT(*) FROM altdesk.Message m WHERE m.ConversationId = c.ConversationId) AS MsgCount
      FROM altdesk.Conversation c
      WHERE ${convWhereKpis}
    )
    SELECT
      COUNT(*) AS TotalConversations,
      COUNT(CASE WHEN Status = 'OPEN' THEN 1 END) AS OpenConversations,
      COUNT(CASE WHEN Status IN ('RESOLVED', 'CLOSED') THEN 1 END) AS ClosedConversations,
      AVG(CAST(MsgCount AS FLOAT)) AS AvgMessageCount,
      AVG(CAST(CsatScore AS FLOAT)) AS AvgCsatScore
    FROM ConvMessageCounts
  `);

  const reqChart = pool.request();
  const convWhereChart = buildConversationWhereClause(reqChart, filters, tenantId, "c");
  const chartResult = await reqChart.query(`
    SELECT
      c.SourceChannel AS label,
      COUNT(*) AS value
    FROM altdesk.Conversation c
    WHERE ${convWhereChart}
    GROUP BY c.SourceChannel
    ORDER BY value DESC
  `);

  const reqDetails = pool.request();
  const convWhereDetails = buildConversationWhereClause(reqDetails, filters, tenantId, "c");
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;
  reqDetails.input("offset", offset);
  reqDetails.input("limit", limit);

  const detailsResult = await reqDetails.query(`
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
      c.SlaDeadline,
      c.CsatScore,
      COUNT(*) OVER() AS TotalRows
    FROM altdesk.Conversation c
    LEFT JOIN altdesk.[User] u ON u.UserId = c.AssignedUserId
    LEFT JOIN altdesk.Queue q ON q.QueueId = c.QueueId
    WHERE ${convWhereDetails}
    ORDER BY c.CreatedAt DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `);

  const kpis = kpiResult.recordset[0] || {
    TotalConversations: 0,
    OpenConversations: 0,
    ClosedConversations: 0,
    AvgMessageCount: 0,
    AvgCsatScore: null,
  };

  const details = detailsResult.recordset;
  const totalRows = details.length > 0 ? details[0].TotalRows : 0;

  return {
    kpis,
    chartData: chartResult.recordset,
    details,
    totalRows,
  };
}

/**
 * 7. Agents Report (Extended)
 */
export async function getAgentsReport(
  tenantId: string,
  filters: ReportFilters
): Promise<ReportResult> {
  const pool = await getPool();

  const reqKpis = pool.request();
  const convWhereKpis = buildConversationWhereClause(reqKpis, filters, tenantId, "c");
  const kpiResult = await reqKpis.query(`
    WITH AgentConvMetrics AS (
      SELECT
        u.UserId,
        COUNT(CASE WHEN c.Status = 'RESOLVED' THEN 1 END) AS ResolvedCount,
        COUNT(CASE WHEN c.SlaStatus = 'VIOLATED' THEN 1 END) AS SlaViolatedCount,
        COUNT(c.ConversationId) AS TotalCount
      FROM altdesk.[User] u
      LEFT JOIN altdesk.Conversation c ON c.AssignedUserId = u.UserId AND ${convWhereKpis}
      WHERE u.TenantId = @tenantId AND u.IsActive = 1
      GROUP BY u.UserId
    )
    SELECT
      COUNT(*) AS TotalActiveAgents,
      AVG(CAST(ResolvedCount AS FLOAT)) AS AvgResolvedPerAgent,
      CAST(100.0 * SUM(SlaViolatedCount) / NULLIF(SUM(TotalCount), 0) AS DECIMAL(5,2)) AS OverallSlaViolationRate
    FROM AgentConvMetrics
  `);

  const reqChart = pool.request();
  const convWhereChart = buildConversationWhereClause(reqChart, filters, tenantId, "c");
  const chartResult = await reqChart.query(`
    SELECT
      u.DisplayName AS label,
      COUNT(CASE WHEN c.Status = 'RESOLVED' THEN 1 END) AS resolved,
      COUNT(CASE WHEN c.Status = 'OPEN' THEN 1 END) AS openConversations
    FROM altdesk.[User] u
    LEFT JOIN altdesk.Conversation c ON c.AssignedUserId = u.UserId AND ${convWhereChart}
    WHERE u.TenantId = @tenantId AND u.IsActive = 1
    GROUP BY u.UserId, u.DisplayName
    HAVING COUNT(c.ConversationId) > 0
    ORDER BY resolved DESC
  `);

  const reqDetails = pool.request();
  const convWhereDetails = buildConversationWhereClause(reqDetails, filters, tenantId, "c");
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;
  reqDetails.input("offset", offset);
  reqDetails.input("limit", limit);

  const detailsResult = await reqDetails.query(`
    SELECT
      u.DisplayName AS AgentName,
      u.Email,
      COUNT(CASE WHEN c.Status = 'RESOLVED' THEN 1 END) AS ResolvedCount,
      COUNT(CASE WHEN c.Status = 'OPEN' THEN 1 END) AS OpenCount,
      COUNT(c.ConversationId) AS TotalCount,
      COUNT(CASE WHEN c.SlaStatus = 'VIOLATED' THEN 1 END) AS SlaViolationsCount,
      COUNT(*) OVER() AS TotalRows
    FROM altdesk.[User] u
    LEFT JOIN altdesk.Conversation c ON c.AssignedUserId = u.UserId AND ${convWhereDetails}
    WHERE u.TenantId = @tenantId AND u.IsActive = 1
    GROUP BY u.UserId, u.DisplayName, u.Email
    ORDER BY ResolvedCount DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `);

  const kpis = kpiResult.recordset[0] || {
    TotalActiveAgents: 0,
    AvgResolvedPerAgent: 0,
    OverallSlaViolationRate: 0.00,
  };

  const details = detailsResult.recordset;
  const totalRows = details.length > 0 ? details[0].TotalRows : 0;

  return {
    kpis,
    chartData: chartResult.recordset,
    details,
    totalRows,
  };
}
