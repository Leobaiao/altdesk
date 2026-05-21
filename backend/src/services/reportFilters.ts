import pkg from "mssql";
const { Request } = pkg;

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  priority?: string;
  channelId?: string;
  queueId?: string;
  agentId?: string; // AssignedAgentId (Ticket) or AssignedUserId (Conversation)
  slaStatus?: string;
  page?: number;
  limit?: number;
}

export function parseReportFilters(query: any): ReportFilters {
  return {
    dateFrom: query.from || query.dateFrom,
    dateTo: query.to || query.dateTo,
    status: query.status,
    priority: query.priority,
    channelId: query.channelId,
    queueId: query.queueId,
    agentId: query.agentId || query.assignedAgentId || query.assignedUserId,
    slaStatus: query.slaStatus,
    page: query.page ? parseInt(String(query.page), 10) : 1,
    limit: query.limit ? parseInt(String(query.limit), 10) : 10,
  };
}

/**
 * Dynamically builds the WHERE clause for queries on the Ticket table, adding parameters to the request.
 */
export function buildTicketWhereClause(
  request: any,
  filters: ReportFilters,
  tenantId: string,
  tableAlias = "t"
): string {
  const clauses = [`${tableAlias}.TenantId = @tenantId`, `${tableAlias}.DeletedAt IS NULL`];
  request.input("tenantId", tenantId);

  if (filters.dateFrom) {
    clauses.push(`${tableAlias}.CreatedAt >= @dateFrom`);
    request.input("dateFrom", new Date(filters.dateFrom));
  }
  if (filters.dateTo) {
    clauses.push(`${tableAlias}.CreatedAt <= @dateTo`);
    request.input("dateTo", new Date(filters.dateTo));
  }
  if (filters.status) {
    clauses.push(`${tableAlias}.Status = @status`);
    request.input("status", filters.status);
  }
  if (filters.priority) {
    clauses.push(`${tableAlias}.Priority = @priority`);
    request.input("priority", filters.priority);
  }
  if (filters.agentId) {
    clauses.push(`${tableAlias}.AssignedAgentId = @agentId`);
    request.input("agentId", filters.agentId);
  }
  if (filters.slaStatus) {
    clauses.push(`${tableAlias}.SlaStatus = @slaStatus`);
    request.input("slaStatus", filters.slaStatus);
  }

  // Joined conditions if c is used
  if (filters.channelId) {
    clauses.push(`c.ChannelId = @channelId`);
    request.input("channelId", filters.channelId);
  }
  if (filters.queueId) {
    clauses.push(`c.QueueId = @queueId`);
    request.input("queueId", filters.queueId);
  }

  return clauses.join(" AND ");
}

/**
 * Dynamically builds the WHERE clause for queries on the Conversation table, adding parameters to the request.
 */
export function buildConversationWhereClause(
  request: any,
  filters: ReportFilters,
  tenantId: string,
  tableAlias = "c"
): string {
  const clauses = [`${tableAlias}.TenantId = @tenantId`, `${tableAlias}.DeletedAt IS NULL`];
  request.input("tenantId", tenantId);

  if (filters.dateFrom) {
    clauses.push(`${tableAlias}.CreatedAt >= @dateFrom`);
    request.input("dateFrom", new Date(filters.dateFrom));
  }
  if (filters.dateTo) {
    clauses.push(`${tableAlias}.CreatedAt <= @dateTo`);
    request.input("dateTo", new Date(filters.dateTo));
  }
  if (filters.status) {
    clauses.push(`${tableAlias}.Status = @status`);
    request.input("status", filters.status);
  }
  if (filters.agentId) {
    clauses.push(`${tableAlias}.AssignedUserId = @agentId`);
    request.input("agentId", filters.agentId);
  }
  if (filters.slaStatus) {
    clauses.push(`${tableAlias}.SlaStatus = @slaStatus`);
    request.input("slaStatus", filters.slaStatus);
  }
  if (filters.channelId) {
    clauses.push(`${tableAlias}.ChannelId = @channelId`);
    request.input("channelId", filters.channelId);
  }
  if (filters.queueId) {
    clauses.push(`${tableAlias}.QueueId = @queueId`);
    request.input("queueId", filters.queueId);
  }

  return clauses.join(" AND ");
}
