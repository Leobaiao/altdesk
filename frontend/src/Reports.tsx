import React, { useState, useEffect, useMemo } from "react";
import { api } from "./lib/api";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "./components/PageHeader";
import { useChat } from "./contexts/ChatContext";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  Download,
  RefreshCw,
  BarChart3,
  AlertOctagon,
  MessageSquareCode,
  UserCheck,
  ShieldAlert,
  MessageCircle,
  Users,
  Calendar,
  Filter,
  X,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  FileText,
  FileDown
} from "lucide-react";

// List of Report Types supported in Phase 1
type ReportType =
  | "status"
  | "priority"
  | "channel"
  | "agent-performance"
  | "sla-compliance"
  | "conversations"
  | "agents";

interface ReportResult {
  kpis: Record<string, number | string>;
  chartData: any[];
  details: any[];
  totalRows: number;
}

// Translations for Table Column Headers
const COLUMN_TRANSLATIONS: Record<string, string> = {
  TicketId: "ID Ticket",
  ConversationId: "ID Conversa",
  ConversationTitle: "Título",
  Status: "Status",
  Priority: "Prioridade",
  SlaStatus: "Status SLA",
  CreatedAt: "Criação",
  AgentName: "Agente",
  ChannelName: "Canal",
  Email: "E-mail",
  ResolvedCount: "Resolvidos",
  OpenCount: "Abertos",
  TotalCount: "Total",
  SlaComplianceRate: "Conformidade SLA",
  AvgFirstResponseTime: "T.M. 1ª Resposta",
  AvgResolutionTime: "T.M. Resolução",
  SlaPercentage: "% SLA",
  FirstResponseAt: "1ª Resposta",
  ResolvedAt: "Resolução",
  SourceChannel: "Canal",
  LastMessageAt: "Últ. Mensagem",
  AssignedAgent: "Agente",
  QueueName: "Fila",
  MessageCount: "Mensagens",
  SlaDeadline: "Prazo SLA",
  CsatScore: "Nota CSAT",
  SlaViolationsCount: "Violações SLA",
};

// Colors mapping matching the dashboard status accents
const STATUS_COLORS: Record<string, string> = {
  NEW: "#6366f1",
  OPEN: "#3b82f6",
  TRIAGE: "#8b5cf6",
  IN_PROGRESS: "#0284c7",
  WAITING_CUSTOMER: "#f59e0b",
  WAITING_THIRD_PARTY: "#f97316",
  ESCALATED: "#ef4444",
  RESOLVED: "#00a884",
  CLOSED: "#667781",
  ON_TIME: "#00a884",
  WARNING: "#f59e0b",
  VIOLATED: "#ea4335",
  OK: "#00a884",
  PENDING: "#f59e0b",
  BREACHED: "#ea4335",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#9ca3af",
  MEDIUM: "#3b82f6",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
  URGENT: "#ef4444",
};

const CHANNEL_COLORS: Record<string, string> = {
  WHATSAPP: "#25d366",
  EMAIL: "#ea4335",
  PLATFORM: "#3b82f6",
  SMS: "#a855f7",
  WEBCHAT: "#3b82f6",
  OUTROS: "#6b7280",
};

const KPI_LABELS: Record<string, string> = {
  TotalTickets: "Total de Tickets",
  ActiveTickets: "Tickets Ativos",
  ClosedTickets: "Tickets Fechados",
  SlaWarningTickets: "SLA em Alerta",
  SlaViolatedTickets: "SLA Violado",
  CriticalTickets: "Críticos",
  HighTickets: "Alta Prioridade",
  MediumTickets: "Média Prioridade",
  LowTickets: "Baixa Prioridade",
  WhatsappTickets: "WhatsApp",
  EmailTickets: "E-mail",
  PlatformTickets: "Webchat / Plataforma",
  SmsTickets: "SMS",
  OtherTickets: "Outros Canais",
  AvgFirstResponseTime: "Tempo Médio 1ª Resposta",
  AvgResolutionTime: "Tempo Médio de Resolução",
  ResolvedTickets: "Tickets Resolvidos",
  OpenTickets: "Tickets Abertos",
  SlaComplianceRate: "Conformidade SLA",
  SlaOnTime: "SLA no Prazo",
  SlaWarning: "SLA em Alerta",
  SlaViolated: "SLA Violado",
  ComplianceRate: "Taxa de Conformidade",
  TotalConversations: "Total de Conversas",
  OpenConversations: "Conversas Abertas",
  ClosedConversations: "Conversas Encerradas",
  AvgMessageCount: "Média de Mensagens/Conversa",
  AvgCsatScore: "Satisfação Média (CSAT)",
  TotalActiveAgents: "Agentes Ativos",
  AvgResolvedPerAgent: "Resoluções / Agente",
  OverallSlaViolationRate: "Taxa de Violação de SLA",
};

export function Reports({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { setSelectedConversationId } = useChat();

  const [report, setReport] = useState<ReportType>("status");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);

  // Filters state
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [slaFilter, setSlaFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [queueFilter, setQueueFilter] = useState("");

  // Dynamic filter dropdowns
  const [agents, setAgents] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [channels, setChannels] = useState<{ value: string; label: string; group?: string }[]>([]);

  // Report results state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [exportLoading, setExportLoading] = useState<"csv" | "xlsx" | "pdf" | null>(null);

  const REPORTS_SIDEBAR = useMemo(() => [
    {
      id: "status" as ReportType,
      label: "Tickets por Status",
      description: "Distribuição e volume de tickets em cada estágio do fluxo.",
      icon: BarChart3
    },
    {
      id: "priority" as ReportType,
      label: "Tickets por Prioridade",
      description: "Visualização por severidade (Baixa, Média, Alta, Crítica).",
      icon: AlertOctagon
    },
    {
      id: "channel" as ReportType,
      label: "Tickets por Canal",
      description: "Origem dos tickets atendidos na plataforma.",
      icon: MessageSquareCode
    },
    {
      id: "agent-performance" as ReportType,
      label: "Performance por Técnico",
      description: "Métricas de resolução, tempos de resposta e conformidade.",
      icon: UserCheck
    },
    {
      id: "sla-compliance" as ReportType,
      label: "Conformidade de SLA",
      description: "Indicadores de tempo limite de resposta e resolução.",
      icon: ShieldAlert
    },
    {
      id: "conversations" as ReportType,
      label: "Conversas",
      description: "Métricas globais de interações e mensagens trafegadas.",
      icon: MessageCircle
    },
    {
      id: "agents" as ReportType,
      label: "Agentes",
      description: "Visão geral e distribuição de carga entre atendentes.",
      icon: Users
    }
  ], []);

  // Fetch filter selections data on mount
  useEffect(() => {
    async function loadFiltersData() {
      // 1. Fetch Agents
      try {
        const resUsers = await api.get("/api/users", { params: { agentsOnly: true } });
        setAgents(resUsers.data || []);
      } catch (err) {
        console.warn("Could not load agents list", err);
      }

      // 2. Fetch Queues
      try {
        const res = await api.get("/api/queues");
        setQueues(res.data || []);
      } catch (e) {
        console.warn("Could not load queues list", e);
      }

      // 3. Fetch Channels dynamically
      const channelsList: { value: string; label: string; group?: string }[] = [
        { value: "WHATSAPP", label: "WhatsApp (Geral)", group: "Canais Padrão" },
        { value: "EMAIL", label: "E-mail (Geral)", group: "Canais Padrão" },
        { value: "PLATFORM", label: "Webchat / Plataforma", group: "Canais Padrão" },
        { value: "SMS", label: "SMS", group: "Canais Padrão" },
      ];

      try {
        const resSettings = await api.get("/api/settings");
        if (resSettings.data && Array.isArray(resSettings.data.instances)) {
          resSettings.data.instances.forEach((inst: any) => {
            if (inst.ChannelId) {
              channelsList.push({
                value: inst.ChannelId,
                label: inst.ChannelName || `${inst.Provider} - ${inst.ConnectorId.slice(0, 8)}`,
                group: "Canais Integrados"
              });
            }
          });
        }
      } catch (e) {
        // Silent catch for non-admin roles
      }

      try {
        const resEmails = await api.get("/api/email-channels");
        if (Array.isArray(resEmails.data)) {
          resEmails.data.forEach((ch: any) => {
            channelsList.push({
              value: ch.EmailChannelId,
              label: ch.Name || ch.EmailAddress,
              group: "Canais de E-mail"
            });
          });
        }
      } catch (e) {
        // Silent catch for non-admin roles
      }

      setChannels(channelsList);
    }

    loadFiltersData();
  }, []);

  // Fetch report data function
  const loadReport = async (pageNumber: number = 1) => {
    setLoading(true);
    try {
      const params: any = {
        page: pageNumber,
        limit,
        from,
        to: to ? `${to}T23:59:59` : undefined,
      };

      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (channelFilter) params.channelId = channelFilter;
      if (slaFilter) params.slaStatus = slaFilter;
      if (agentFilter) params.agentId = agentFilter;
      if (queueFilter) params.queueId = queueFilter;

      const endpoint = `/api/reports/${report}`;
      const response = await api.get(endpoint, { params });
      
      setResult({
        kpis: response.data?.kpis || {},
        chartData: response.data?.chartData || [],
        details: response.data?.details || [],
        totalRows: response.data?.totalRows || 0
      });
    } catch (err) {
      console.error("Erro ao gerar relatório:", err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger report reload when report tab changes or page changes
  useEffect(() => {
    setPage(1);
    loadReport(1);
  }, [report]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (result && newPage > Math.ceil(result.totalRows / limit))) return;
    setPage(newPage);
    loadReport(newPage);
  };

  const handleClearFilters = () => {
    setStatusFilter("");
    priorityFilter && setPriorityFilter("");
    setChannelFilter("");
    setSlaFilter("");
    setAgentFilter("");
    setQueueFilter("");
    setPage(1);
    // Directly fetch with cleared filters
    setTimeout(() => loadReport(1), 0);
  };

  // Universal download/export function
  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    setExportLoading(format);
    try {
      const params: any = {
        reportType: report,
        format,
        from,
        to: to ? `${to}T23:59:59` : undefined,
      };

      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (channelFilter) params.channelId = channelFilter;
      if (slaFilter) params.slaStatus = slaFilter;
      if (agentFilter) params.agentId = agentFilter;
      if (queueFilter) params.queueId = queueFilter;

      const response = await api.get("/api/reports/export", {
        params,
        responseType: "blob",
      });

      const blobType =
        format === "pdf"
          ? "application/pdf"
          : format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv; charset=utf-8";

      const blob = new Blob([response.data], { type: blobType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const dateStr = new Date().toISOString().split("T")[0];
      const reportTitle = REPORTS_SIDEBAR.find(r => r.id === report)?.label || report;
      const safeReportTitle = String(reportTitle).replace(/[^a-zA-Z0-9_\u00C0-\u00FF -]/g, "").replace(/\s+/g, "_");
      const safeFormat = String(format).replace(/[^a-zA-Z0-9]/g, "");
      link.download = `${safeReportTitle}_${dateStr}.${safeFormat}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao exportar arquivo", error);
      alert("Falha ao exportar o arquivo. Verifique se o backend está ativo.");
    } finally {
      setExportLoading(null);
    }
  };

  // Cell and KPI formatting functions
  const formatKpiValue = (key: string, value: any) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "number") {
      const lower = key.toLowerCase();
      if (lower.includes("rate") || lower.includes("compliance") || lower.includes("percent") || lower.includes("violationrate")) {
        return `${value.toFixed(1)}%`;
      }
      if (lower.includes("time")) {
        if (value < 60) return `${Math.round(value)} min`;
        const hrs = Math.floor(value / 60);
        const mins = Math.round(value % 60);
        return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
      }
      if (lower.includes("score") || lower.includes("csat")) {
        return `${value.toFixed(1)} / 5`;
      }
      return value.toLocaleString("pt-BR");
    }
    return String(value);
  };

  const getKpiConfig = (key: string) => {
    const k = key.toLowerCase();
    if (k.includes("violated") || k.includes("critical") || k.includes("violation") || k.includes("warning")) {
      const isWarning = k.includes("warning");
      return {
        color: isWarning ? "#f59e0b" : "#ea4335",
        icon: isWarning ? Clock : AlertTriangle,
        bg: isWarning ? "rgba(245, 158, 11, 0.1)" : "rgba(234, 67, 53, 0.1)"
      };
    }
    if (
      k.includes("resolved") ||
      k.includes("closed") ||
      k.includes("compliance") ||
      k.includes("ontime") ||
      k.includes("rate") ||
      k.includes("activeagents")
    ) {
      return { color: "#00a884", icon: CheckCircle2, bg: "rgba(0, 168, 132, 0.1)" };
    }
    if (k.includes("csat") || k.includes("score")) {
      return { color: "#eab308", icon: Star, bg: "rgba(234, 179, 8, 0.1)" };
    }
    return { color: "#3b82f6", icon: BarChart3, bg: "rgba(59, 130, 246, 0.1)" };
  };

  const formatCellValue = (col: string, val: any) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "Sim" : "Não";

    // Detect dates
    if (
      typeof val === "string" &&
      (val.includes("T") ||
        col.toLowerCase().includes("at") ||
        col.toLowerCase().includes("date") ||
        col.toLowerCase().includes("deadline"))
    ) {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString("pt-BR");
      }
    }

    const valStr = String(val).toUpperCase();
    if (col === "Status") {
      const statusLabels: Record<string, string> = {
        NEW: "Novo",
        OPEN: "Aberto",
        TRIAGE: "Em Triagem",
        IN_PROGRESS: "Em Atendimento",
        WAITING_CUSTOMER: "Aguardando Cliente",
        WAITING_THIRD_PARTY: "Aguardando Terceiro",
        ESCALATED: "Escalado",
        RESOLVED: "Resolvido",
        CLOSED: "Fechado",
      };
      return statusLabels[valStr] || val;
    }
    if (col === "Priority") {
      const priorityLabels: Record<string, string> = {
        LOW: "Baixa",
        MEDIUM: "Média",
        HIGH: "Alta",
        CRITICAL: "Crítica",
        URGENT: "Urgente",
      };
      return priorityLabels[valStr] || val;
    }
    if (col === "SlaStatus") {
      const slaLabels: Record<string, string> = {
        OK: "No Prazo",
        ON_TIME: "No Prazo",
        WARNING: "Atenção",
        VIOLATED: "Fora do SLA",
        BREACHED: "Fora do SLA",
        PENDING: "Pendente",
      };
      return slaLabels[valStr] || val;
    }

    if (typeof val === "number") {
      if (col.toLowerCase().includes("rate") || col.toLowerCase().includes("compliance") || col.toLowerCase().includes("percentage")) {
        return `${val.toFixed(1)}%`;
      }
      if (col.toLowerCase().includes("time")) {
        if (val < 60) return `${Math.round(val)} min`;
        const hrs = Math.floor(val / 60);
        const mins = Math.round(val % 60);
        return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
      }
    }

    return String(val);
  };

  const renderCell = (col: string, val: any) => {
    const formatted = formatCellValue(col, val);
    if (formatted === "—") return <span style={{ color: "var(--text-secondary)", opacity: 0.4 }}>—</span>;

    const valStr = String(val).toUpperCase();
    if (col === "SlaStatus") {
      let bg = "rgba(0, 168, 132, 0.1)";
      let color = "#00a884";
      if (valStr === "VIOLATED" || valStr === "BREACHED") {
        bg = "rgba(234, 67, 53, 0.1)";
        color = "#ea4335";
      } else if (valStr === "WARNING") {
        bg = "rgba(245, 158, 11, 0.1)";
        color = "#f59e0b";
      } else if (valStr === "PENDING") {
        bg = "var(--bg-active)";
        color = "var(--text-secondary)";
      }
      return (
        <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700, background: bg, color }}>
          {formatted}
        </span>
      );
    }

    if (col === "Priority") {
      let bg = "var(--bg-active)";
      let color = "var(--text-secondary)";
      if (valStr === "CRITICAL" || valStr === "URGENT") {
        bg = "rgba(239, 68, 68, 0.15)";
        color = "#ef4444";
      } else if (valStr === "HIGH") {
        bg = "rgba(249, 115, 22, 0.15)";
        color = "#f97316";
      } else if (valStr === "MEDIUM") {
        bg = "rgba(59, 130, 246, 0.15)";
        color = "#3b82f6";
      } else if (valStr === "LOW") {
        bg = "var(--bg-active)";
        color = "var(--text-secondary)";
      }
      return (
        <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700, background: bg, color }}>
          {formatted}
        </span>
      );
    }

    if (col === "Status") {
      const color = STATUS_COLORS[valStr] || "var(--text-secondary)";
      return (
        <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700, background: `${color}15`, color }}>
          {formatted}
        </span>
      );
    }

    return formatted;
  };

  // Navigates on row click
  const handleRowClick = (row: any) => {
    const ticketId = row.TicketId;
    const conversationId = row.ConversationId;

    if (ticketId) {
      // Navigate to tickets page and pass the ticketId in state
      navigate("/tickets", { state: { ticketId } });
    } else if (conversationId) {
      // Focus conversation in Chat context and navigate to chat
      setSelectedConversationId(conversationId);
      navigate("/chat");
    }
  };

  // Helper for grouping channel selector options
  const groupedChannels = useMemo(() => {
    const groups: Record<string, typeof channels> = {};
    channels.forEach(ch => {
      const gName = ch.group || "Outros";
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push(ch);
    });
    return groups;
  }, [channels]);

  // Dynamic Chart Rendering
  const renderChart = () => {
    if (!result || !result.chartData || result.chartData.length === 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "var(--text-secondary)", opacity: 0.6 }}>
          <TrendingUp size={40} style={{ marginBottom: 10 }} />
          <span>Sem dados para gerar gráficos no período selecionado.</span>
        </div>
      );
    }

    const chartData = result.chartData;

    // Custom Tooltip component
    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: 8, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: "var(--text-primary)" }}>{label}</p>
            {payload.map((p: any, idx: number) => (
              <p key={idx} style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: p.color || p.fill }}>
                {p.name}: <span style={{ fontWeight: 700 }}>{p.value.toLocaleString("pt-BR")}</span>
              </p>
            ))}
          </div>
        );
      }
      return null;
    };

    switch (report) {
      case "status":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
              <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Tickets" radius={[6, 6, 0, 0]}>
                {chartData.map((entry: any, index: number) => {
                  const labelUpper = (entry.label || "").toUpperCase();
                  const color = STATUS_COLORS[labelUpper] || "#3b82f6";
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "priority":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
              <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Tickets" radius={[6, 6, 0, 0]}>
                {chartData.map((entry: any, index: number) => {
                  const labelUpper = (entry.label || "").toUpperCase();
                  const color = PRIORITY_COLORS[labelUpper] || "#3b82f6";
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "channel":
      case "conversations":
        return (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-around" }}>
            <div style={{ width: "100%", maxWidth: 350, height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="label"
                  >
                    {chartData.map((entry: any, index: number) => {
                      const labelUpper = (entry.label || "").toUpperCase();
                      const color = CHANNEL_COLORS[labelUpper] || ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6"][index % 6];
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 150, padding: 12 }}>
              {chartData.map((entry: any, index: number) => {
                const labelUpper = (entry.label || "").toUpperCase();
                const color = CHANNEL_COLORS[labelUpper] || ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6"][index % 6];
                return (
                  <div key={entry.label || "Outros"} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.8rem" }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{entry.label || "Outros"}:</span>
                    <span style={{ color: "var(--text-secondary)" }}>{entry.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "sla-compliance":
        return (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-around" }}>
            <div style={{ width: "100%", maxWidth: 350, height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="label"
                  >
                    {chartData.map((entry: any, index: number) => {
                      const labelUpper = (entry.label || "").toUpperCase();
                      let color = "#00a884"; // ON_TIME / OK
                      if (labelUpper.includes("VIOLAT") || labelUpper.includes("BREACH")) {
                        color = "#ea4335";
                      } else if (labelUpper.includes("WARN")) {
                        color = "#f59e0b";
                      } else if (labelUpper.includes("PENDING")) {
                        color = "#8696a0";
                      }
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 150, padding: 12 }}>
              {chartData.map((entry: any, index: number) => {
                const labelUpper = (entry.label || "").toUpperCase();
                let color = "#00a884";
                let labelText = entry.label || "Outros";
                if (labelUpper.includes("VIOLAT") || labelUpper.includes("BREACH")) {
                  color = "#ea4335";
                  labelText = "Fora do SLA";
                } else if (labelUpper.includes("WARN")) {
                  color = "#f59e0b";
                  labelText = "Em Risco";
                } else if (labelUpper.includes("PENDING")) {
                  color = "#8696a0";
                  labelText = "Pendente";
                } else if (labelUpper.includes("ON") || labelUpper.includes("OK")) {
                  color = "#00a884";
                  labelText = "No Prazo";
                }
                return (
                  <div key={entry.label || "Outros"} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.8rem" }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{labelText}:</span>
                    <span style={{ color: "var(--text-secondary)" }}>{entry.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "agent-performance":
      case "agents":
        const hasOpen = chartData.some((c: any) => c.openTickets !== undefined || c.openConversations !== undefined);
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
              <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="resolved" name="Resolvidos" fill="#00a884" radius={[4, 4, 0, 0]} />
              {hasOpen && (
                <Bar
                  dataKey={report === "agents" ? "openConversations" : "openTickets"}
                  name="Abertos"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  // Build columns list dynamically from data
  const tableColumns = useMemo(() => {
    if (!result || !result.details || result.details.length === 0) return [];
    return Object.keys(result.details[0]);
  }, [result]);

  return (
    <div className="settings-page" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader
        title="Relatórios & Indicadores"
        subtitle="Analise métricas de suporte, conformidade de SLA e performance da equipe."
        icon={BarChart3}
        onBack={onBack}
        contextKey="reports.index"
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", marginTop: 16, gap: 16 }}>
        {/* Left column: Sidebar list of reports */}
        <div style={{
          width: 280,
          background: "var(--bg-secondary)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          padding: "16px 12px",
          gap: 6,
          flexShrink: 0,
          overflowY: "auto"
        }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "1px", padding: "0 8px 8px 8px", borderBottom: "1px solid var(--border)" }}>
            Categorias de Relatório
          </span>
          {REPORTS_SIDEBAR.map(r => {
            const IconComp = r.icon;
            const isSelected = report === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setReport(r.id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: isSelected ? "var(--bg-hover)" : "transparent",
                  color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  outline: "none",
                  borderLeft: isSelected ? "4px solid var(--accent)" : "4px solid transparent"
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: isSelected ? "rgba(0, 168, 132, 0.1)" : "var(--bg-primary)",
                  color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <IconComp size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {r.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right column: Report view container */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", paddingRight: 4, gap: 16 }}>
          
          {/* Section 1: Filters */}
          <div style={{
            background: "var(--bg-secondary)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              <Filter size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Filtros de Pesquisa
              </span>
            </div>

            {/* Filters grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12
            }}>
              {/* De */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Data Inicial</label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Calendar size={14} style={{ position: "absolute", left: 10, color: "var(--text-secondary)", pointerEvents: "none" }} />
                  <input
                    type="date"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 30px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--bg-primary)",
                      color: "var(--text-primary)",
                      fontSize: "0.8rem",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              {/* Até */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Data Final</label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Calendar size={14} style={{ position: "absolute", left: 10, color: "var(--text-secondary)", pointerEvents: "none" }} />
                  <input
                    type="date"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 30px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--bg-primary)",
                      color: "var(--text-primary)",
                      fontSize: "0.8rem",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              {/* Status */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "0.8rem",
                    outline: "none"
                  }}
                >
                  <option value="">Todos</option>
                  <option value="NEW">Novo</option>
                  <option value="OPEN">Aberto</option>
                  <option value="TRIAGE">Em Triagem</option>
                  <option value="IN_PROGRESS">Em Atendimento</option>
                  <option value="WAITING_CUSTOMER">Aguardando Cliente</option>
                  <option value="WAITING_THIRD_PARTY">Aguardando Terceiro</option>
                  <option value="ESCALATED">Escalado</option>
                  <option value="RESOLVED">Resolvido</option>
                  <option value="CLOSED">Fechado</option>
                </select>
              </div>

              {/* Priority */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Prioridade</label>
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "0.8rem",
                    outline: "none"
                  }}
                >
                  <option value="">Todas</option>
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </div>

              {/* Channel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Canal de Entrada</label>
                <select
                  value={channelFilter}
                  onChange={e => setChannelFilter(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "0.8rem",
                    outline: "none"
                  }}
                >
                  <option value="">Todos</option>
                  {Object.entries(groupedChannels).map(([groupName, items]) => (
                    <optgroup key={groupName} label={groupName}>
                      {items.map(ch => (
                        <option key={ch.value} value={ch.value}>
                          {ch.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* SLA compliance status */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Status do SLA</label>
                <select
                  value={slaFilter}
                  onChange={e => setSlaFilter(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "0.8rem",
                    outline: "none"
                  }}
                >
                  <option value="">Todos</option>
                  <option value="OK">Dentro do SLA</option>
                  <option value="WARNING">Aviso / Próximo ao Limite</option>
                  <option value="VIOLATED">Fora do SLA / Estourado</option>
                </select>
              </div>

              {/* Agent */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Técnico / Agente</label>
                <select
                  value={agentFilter}
                  onChange={e => setAgentFilter(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "0.8rem",
                    outline: "none"
                  }}
                >
                  <option value="">Todos</option>
                  {agents.map(a => (
                    <option key={a.UserId} value={a.UserId}>
                      {a.AgentName || a.Name || a.Email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Queue */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Fila / Setor</label>
                <select
                  value={queueFilter}
                  onChange={e => setQueueFilter(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "0.8rem",
                    outline: "none"
                  }}
                >
                  <option value="">Todas</option>
                  {queues.map(q => (
                    <option key={q.QueueId} value={q.QueueId}>
                      {q.Name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions panel */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => loadReport(1)}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 8, padding: "8px 16px", fontSize: "0.85rem" }}
                >
                  <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                  {loading ? "Carregando..." : "Filtrar Relatório"}
                </button>
                <button
                  onClick={handleClearFilters}
                  disabled={loading}
                  className="btn btn-ghost"
                  style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "8px 14px", border: "1px solid var(--border)", fontSize: "0.85rem" }}
                >
                  Limpar
                </button>
              </div>

              {result && result.details.length > 0 && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", marginRight: 4 }}>
                    Exportar Base:
                  </span>
                  
                  {/* CSV Export */}
                  <button
                    onClick={() => handleExport("csv")}
                    disabled={exportLoading !== null}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "var(--bg-primary)",
                      border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700,
                      color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s"
                    }}
                    title="Exportar como CSV"
                  >
                    <FileText size={13} style={{ color: "#3b82f6" }} />
                    {exportLoading === "csv" ? "Processando..." : "CSV"}
                  </button>

                  {/* XLSX Export */}
                  <button
                    onClick={() => handleExport("xlsx")}
                    disabled={exportLoading !== null}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "var(--bg-primary)",
                      border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700,
                      color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s"
                    }}
                    title="Exportar como Excel (XLSX)"
                  >
                    <FileSpreadsheet size={13} style={{ color: "#00a884" }} />
                    {exportLoading === "xlsx" ? "Processando..." : "Excel"}
                  </button>

                  {/* PDF Export */}
                  <button
                    onClick={() => handleExport("pdf")}
                    disabled={exportLoading !== null}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "var(--bg-primary)",
                      border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700,
                      color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s"
                    }}
                    title="Exportar como Documento PDF"
                  >
                    <FileDown size={13} style={{ color: "#ea4335" }} />
                    {exportLoading === "pdf" ? "Processando..." : "PDF"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: KPIs & Visual Charts */}
          {result && (
            <>
              {/* KPIs Grid */}
              {Object.keys(result.kpis).length > 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 14
                }}>
                  {Object.entries(result.kpis).map(([key, val]) => {
                    const cfg = getKpiConfig(key);
                    const label = KPI_LABELS[key] || key.replace(/([A-Z])/g, " $1").trim();
                    const FormattedIcon = cfg.icon;
                    return (
                      <div
                        key={key}
                        style={{
                          background: "var(--bg-secondary)",
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          borderLeft: `4px solid ${cfg.color}`,
                          padding: "16px 20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)"
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", display: "block" }}>
                            {label}
                          </span>
                          <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", display: "block", marginTop: 4 }}>
                            {formatKpiValue(key, val)}
                          </span>
                        </div>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: cfg.bg,
                          color: cfg.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          <FormattedIcon size={18} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Chart Container */}
              <div style={{
                background: "var(--bg-secondary)",
                borderRadius: 16,
                border: "1px solid var(--border)",
                padding: "20px 24px"
              }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", borderBottom: "1px solid var(--border)", paddingBottom: 8, display: "block", marginBottom: 16 }}>
                  Resumo Gráfico
                </span>
                {renderChart()}
              </div>

              {/* Detailed Table */}
              <div style={{
                background: "var(--bg-secondary)",
                borderRadius: 16,
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Registros Detalhados
                  </span>
                  {result.totalRows > 0 && (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", background: "var(--bg-primary)", padding: "4px 10px", borderRadius: 10 }}>
                      Mostrando {result.details.length} de {result.totalRows} registros
                    </span>
                  )}
                </div>

                <div style={{ overflowX: "auto" }}>
                  {result.details.length > 0 ? (
                    <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-primary)", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)" }}>
                          {tableColumns.map(col => {
                            if (col === "TicketId" || col === "ConversationId") return null;
                            return (
                              <th
                                key={col}
                                style={{
                                  padding: "14px 20px",
                                  textAlign: "left",
                                  fontSize: "0.68rem",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.6px",
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {COLUMN_TRANSLATIONS[col] || col.replace(/([A-Z])/g, " $1").trim()}
                              </th>
                            );
                          })}
                          <th style={{ width: 40 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {result.details.map((row, i) => (
                          <tr
                            key={i}
                            onClick={() => handleRowClick(row)}
                            style={{
                              borderBottom: "1px solid var(--border)",
                              cursor: "pointer",
                              transition: "background 0.15s"
                            }}
                            className="table-row-hover"
                          >
                            {tableColumns.map(col => {
                              if (col === "TicketId" || col === "ConversationId") return null;
                              return (
                                <td
                                  key={col}
                                  style={{
                                    padding: "12px 20px",
                                    color: "var(--text-primary)",
                                    whiteSpace: "nowrap",
                                    verticalAlign: "middle"
                                  }}
                                >
                                  {renderCell(col, row[col])}
                                </td>
                              );
                            })}
                            <td style={{ paddingRight: 20, textAlign: "right", verticalAlign: "middle" }}>
                              <ArrowRight size={14} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>
                      Nenhum detalhe disponível para a pesquisa selecionada.
                    </div>
                  )}
                </div>

                {/* Table Pagination Controls */}
                {result.totalRows > limit && (
                  <div style={{
                    padding: "12px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: "1px solid var(--border)",
                    flexWrap: "wrap",
                    gap: 12,
                    background: "var(--bg-primary)"
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      Página <b>{page}</b> de <b>{Math.ceil(result.totalRows / limit)}</b>
                    </span>

                    <div style={{ display: "flex", gap: 4 }}>
                      {/* First Page */}
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={page === 1}
                        style={{
                          width: 32, height: 32, borderRadius: 6, border: "1px solid var(--border)",
                          background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, color: "var(--text-primary)"
                        }}
                      >
                        <ChevronsLeft size={16} />
                      </button>

                      {/* Prev Page */}
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        style={{
                          width: 32, height: 32, borderRadius: 6, border: "1px solid var(--border)",
                          background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, color: "var(--text-primary)"
                        }}
                      >
                        <ChevronLeft size={16} />
                      </button>

                      {/* Page display */}
                      <div style={{
                        padding: "0 14px", height: 32, borderRadius: 6, border: "1px solid var(--border)",
                        background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)"
                      }}>
                        {page}
                      </div>

                      {/* Next Page */}
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === Math.ceil(result.totalRows / limit)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, border: "1px solid var(--border)",
                          background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: page === Math.ceil(result.totalRows / limit) ? "not-allowed" : "pointer",
                          opacity: page === Math.ceil(result.totalRows / limit) ? 0.4 : 1, color: "var(--text-primary)"
                        }}
                      >
                        <ChevronRight size={16} />
                      </button>

                      {/* Last Page */}
                      <button
                        onClick={() => handlePageChange(Math.ceil(result.totalRows / limit))}
                        disabled={page === Math.ceil(result.totalRows / limit)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, border: "1px solid var(--border)",
                          background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: page === Math.ceil(result.totalRows / limit) ? "not-allowed" : "pointer",
                          opacity: page === Math.ceil(result.totalRows / limit) ? 0.4 : 1, color: "var(--text-primary)"
                        }}
                      >
                        <ChevronsRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Initial / Empty State */}
          {!result && !loading && (
            <div style={{
              textAlign: "center", padding: 64, color: "var(--text-secondary)",
              background: "var(--bg-secondary)", borderRadius: 16, border: "1px dashed var(--border)"
            }}>
              <BarChart3 size={48} opacity={0.15} style={{ marginBottom: 12 }} />
              <p>Configure os filtros de pesquisa e clique em <b>Filtrar Relatório</b> para exibir os dados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
