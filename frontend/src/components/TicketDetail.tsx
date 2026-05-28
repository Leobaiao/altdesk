import React, { useEffect, useState } from "react";
import {
    ArrowLeft,
    Clock,
    User,
    ArrowUpRight,
    CheckCircle,
    MessageCircle,
    AlertCircle,
    FileText,
    RefreshCw,
    X,
    Send,
    BookOpen,
    Zap,
    Search,
    RotateCcw,
    ShieldAlert,
    Timer,
    Phone,
    Loader2,
    History
} from "lucide-react";
import { api } from "../lib/api";
import type { TicketData } from "./TicketList";
import { ConfirmModal } from "./Modal";
import { useChat } from "../contexts/ChatContext";
import { ChatWindow } from "./ChatWindow";

function formatWhatsApp(raw: string) {
    if (!raw) return "";
    let number = raw.replace("@s.whatsapp.net", "").replace("@c.us", "");
    const digits = number.replace(/\D/g, "");
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        const ddd = digits.substring(2, 4);
        const part1 = digits.length === 13 ? digits.substring(4, 9) : digits.substring(4, 8);
        const part2 = digits.length === 13 ? digits.substring(9) : digits.substring(8);
        return `+55 (${ddd}) ${part1}-${part2}`;
    }
    return number;
}

interface HistoryEntry {
    HistoryId: string;
    SequenceNumber: number;
    Action: string;
    ActorUserId: string | null;
    EscalatedToUserId: string | null;
    MetadataJson: string | null;
    CreatedAt: string;
    ActorEmail: string | null;
    ActorName: string | null;
    EscalatedToEmail: string | null;
}

interface UserOption {
    UserId: string;
    Email: string;
    AgentName?: string;
    Name?: string;
}

function getActionDisplayInfo(action: string) {
    const map: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
        OPENED: { label: "Chamado Aberto", icon: <AlertCircle size={16} />, color: "#00a884" },
        REPLIED: { label: "Resposta Enviada", icon: <MessageCircle size={16} />, color: "#3498db" },
        ESCALATED: { label: "Escalado", icon: <ArrowUpRight size={16} />, color: "#e67e22" },
        CLOSED: { label: "Fechado", icon: <CheckCircle size={16} />, color: "#8696a0" },
        COMMENTED: { label: "Comentário", icon: <FileText size={16} />, color: "#9b59b6" },
        ASSIGNED: { label: "Atribuído", icon: <User size={16} />, color: "#2ecc71" },
        STATUS_CHANGED: { label: "Status Alterado", icon: <RefreshCw size={16} />, color: "#f1c40f" },
    };
    return map[action] || { label: action, icon: <Clock size={16} />, color: "#8696a0" };
}

function formatDateTime(d: string) {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

interface TicketDetailProps {
    ticket: TicketData;
    onBack: () => void;
    profile: any;
    role: string;
    onTicketUpdate: () => void;
    onSelectTicket?: (ticket: TicketData) => void;
}

export function TicketDetail({ ticket, onBack, profile, role, onTicketUpdate, onSelectTicket }: TicketDetailProps) {
    const { showToast, setSelectedConversationId } = useChat();
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEscalateModal, setShowEscalateModal] = useState(false);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [comment, setComment] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showKBModal, setShowKBModal] = useState(false);
    const [showCannedMenu, setShowCannedMenu] = useState(false);
    const [kbArticles, setKbArticles] = useState<any[]>([]);
    const [cannedResponses, setCannedResponses] = useState<any[]>([]);
    const [kbSearch, setKbSearch] = useState("");
    const [showSaveToKB, setShowSaveToKB] = useState(false);
    const [kbForm, setKbForm] = useState({ title: "", content: "", category: "Resolvidos" });
    const [activeTab, setActiveTab] = useState<"CHAT" | "TIMELINE">("CHAT");
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [historyTickets, setHistoryTickets] = useState<TicketData[]>([]);
    const [loadingHistoryTickets, setLoadingHistoryTickets] = useState(false);
    const [resolutionDescription, setResolutionDescription] = useState("");

    async function loadContactTicketsHistory() {
        setLoadingHistoryTickets(true);
        try {
            const res = await api.get<TicketData[]>("/api/conversations");
            const allTickets = Array.isArray(res.data) ? res.data : [];
            const filtered = allTickets.filter(t => 
                t.ConversationId !== ticket.ConversationId && (
                    (ticket.ExternalUserId && t.ExternalUserId === ticket.ExternalUserId) ||
                    (ticket.ContactPhone && t.ContactPhone === ticket.ContactPhone) ||
                    (ticket.ContactCPF && ticket.ContactCPF !== "—" && t.ContactCPF === ticket.ContactCPF) ||
                    (ticket.RequesterUserId && t.RequesterUserId === ticket.RequesterUserId)
                )
            );
            setHistoryTickets(filtered);
        } catch (e) {
            console.error("Error loading contact ticket history:", e);
        } finally {
            setLoadingHistoryTickets(false);
        }
    }

    useEffect(() => {
        if (ticket.ConversationId) {
            setSelectedConversationId(ticket.ConversationId);
        }
    }, [ticket.ConversationId, setSelectedConversationId]);

    async function loadHistory() {
        setLoading(true);
        try {
            const res = await api.get(`/api/conversations/${ticket.ConversationId}/history`);
            setHistory(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("Error loading history:", e);
        } finally {
            setLoading(false);
        }
    }

    async function loadKbArticles() {
        try {
            const res = await api.get("/api/knowledge");
            setKbArticles(Array.isArray(res.data) ? res.data : []);
            setShowKBModal(true);
        } catch (e) {
            console.error("Error loading KB articles:", e);
        }
    }

    async function loadCannedResponses() {
        try {
            const res = await api.get("/api/canned-responses");
            setCannedResponses(Array.isArray(res.data) ? res.data : []);
            setShowCannedMenu(!showCannedMenu);
        } catch (e) {
            console.error("Error loading canned responses:", e);
        }
    }

    useEffect(() => { loadHistory(); }, [ticket.ConversationId]);

    const canEscalate = profile?.CanEscalate || profile?.Role === "ADMIN" || profile?.Role === "SUPERADMIN";
    const canClose = profile?.CanClose || profile?.Role === "ADMIN" || profile?.Role === "SUPERADMIN";
    const canComment = profile?.CanComment !== false; 
    const hasLogAccess = profile?.HasLogAccess || profile?.Role === "ADMIN" || profile?.Role === "SUPERADMIN";

    async function handleClose() {
        if (!resolutionDescription.trim()) return;
        setActionLoading(true);
        try {
            await api.post(`/api/conversations/${ticket.ConversationId}/status`, { 
                status: "RESOLVED",
                resolution: resolutionDescription
            });
            setResolutionDescription("");
            onTicketUpdate();
            loadHistory();
        } catch (e: any) {
            showToast("Erro ao fechar chamado: " + (e.response?.data?.error || e.message), "error");
        } finally {
            setActionLoading(false);
            setShowCloseConfirm(false);
        }
    }

    async function handleReopen() {
        setActionLoading(true);
        try {
            await api.post(`/api/conversations/${ticket.ConversationId}/status`, { status: "OPEN" });
            onTicketUpdate();
            loadHistory();
        } catch (e: any) {
            showToast("Erro ao reabrir chamado: " + (e.response?.data?.error || e.message), "error");
        } finally {
            setActionLoading(false);
        }
    }

    async function handleEscalate(userId: string) {
        setActionLoading(true);
        try {
            await api.post(`/api/conversations/${ticket.ConversationId}/assign`, { userId });
            setShowEscalateModal(false);
            onTicketUpdate();
            loadHistory();
        } catch (e: any) {
            showToast("Erro ao escalar: " + (e.response?.data?.error || e.message), "error");
        } finally {
            setActionLoading(false);
        }
    }

    async function handleSendComment() {
        if (!comment.trim() || !ticket.ConversationId || actionLoading) return;
        setActionLoading(true);
        try {
            await api.post(`/api/conversations/${ticket.ConversationId}/note`, { text: comment });
            setComment("");
            showToast("Comentário adicionado!", "success");
            loadHistory();
        } catch (e: any) {
            showToast("Erro ao adicionar comentário: " + (e.response?.data?.error || e.message), "error");
        } finally {
            setActionLoading(false);
        }
    }

    async function openEscalateModal() {
        try {
            const res = await api.get<UserOption[]>("/api/users?agentsOnly=true");
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error(e);
        }
        setShowEscalateModal(true);
    }

    async function openAuditLog() {
        setAuditLogs(history.map(h => ({
            action: h.Action,
            actor: h.ActorEmail || "Sistema",
            time: h.CreatedAt,
            meta: h.MetadataJson ? JSON.parse(h.MetadataJson) : null
        })));
        setShowAuditModal(true);
    }

    async function handleSaveToKB() {
        if (!kbForm.title.trim() || !kbForm.content.trim()) return;
        setActionLoading(true);
        try {
            await api.post("/api/knowledge", {
                Title: kbForm.title,
                Content: kbForm.content,
                Category: kbForm.category,
                IsPublic: true
            });
            setShowSaveToKB(false);
            showToast("Artigo salvo na Base de Conhecimento!", "success");
        } catch (e: any) {
            showToast("Erro ao salvar artigo: " + (e.response?.data?.error || e.message), "error");
        } finally {
            setActionLoading(false);
        }
    }

    function openSaveToKB() {
        const relevantHistory = history.filter(h => h.Action === 'REPLIED' || h.Action === 'OPENED' || h.Action === 'COMMENTED');
        const contentLines = relevantHistory.map(h => {
            let meta: any = {};
            try { meta = h.MetadataJson ? JSON.parse(h.MetadataJson) : {}; } catch {}
            const text = meta.text || meta.body || (h.Action === 'OPENED' ? "Abertura do chamado" : "");
            if (!text) return "";
            const sender = h.ActorName || h.ActorEmail || (meta.direction === "IN" ? "Cliente" : "Sistema");
            const prefix = h.Action === 'COMMENTED' ? "[NOTA INTERNA]" : `[${sender}]`;
            return `${prefix}: ${text}`;
        }).filter(t => !!t);

        setKbForm({
            title: `Solução: ${ticket.Title || "Chamado #" + ticket.id}`,
            content: contentLines.join('\n\n'),
            category: "Resolvidos"
        });
        setShowSaveToKB(true);
    }

    return (
        <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "var(--bg-primary)" }}>
            
            {/* Esquerda: Área de Conversa/Chat */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", minWidth: 0 }}>
                {/* Header de Navegação */}
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button onClick={onBack} className="btn btn-ghost" style={{ padding: 8, borderRadius: "50%" }}>
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{ticket.Title || "Ticket #" + ticket.id}</h2>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
                                ID: {ticket.id} · Aberto em {formatDateTime(ticket.CreatedAt || "")}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "flex", background: "var(--bg-primary)", padding: 4, borderRadius: 10, gap: 4, alignItems: "center" }}>
                        <button 
                            onClick={() => setActiveTab("CHAT")}
                            style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", background: activeTab === "CHAT" ? "var(--bg-secondary)" : "transparent", color: activeTab === "CHAT" ? "var(--accent)" : "var(--text-secondary)", boxShadow: activeTab === "CHAT" ? "0 2px 6px rgba(0,0,0,0.05)" : "none" }}
                        >
                            Conversa
                        </button>
                        <button 
                            onClick={() => setActiveTab("TIMELINE")}
                            style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", background: activeTab === "TIMELINE" ? "var(--bg-secondary)" : "transparent", color: activeTab === "TIMELINE" ? "var(--accent)" : "var(--text-secondary)", boxShadow: activeTab === "TIMELINE" ? "0 2px 6px rgba(0,0,0,0.05)" : "none" }}
                        >
                            Linha do Tempo
                        </button>
                        <button 
                            onClick={() => {
                                loadContactTicketsHistory();
                                setShowHistoryDrawer(true);
                            }}
                            style={{ 
                                background: "none", 
                                border: "none", 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                cursor: "pointer", 
                                color: "var(--text-secondary)", 
                                padding: "4px 8px",
                                borderRadius: 6,
                                transition: "background-color 0.2s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-secondary)"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                            title="Histórico de Chamados do Cliente"
                        >
                            <History size={16} />
                        </button>
                    </div>
                </div>

                {/* Conteúdo Dinâmico */}
                <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    {activeTab === "CHAT" ? (
                        <ChatWindow setView={() => {}} hideHeader={true} />
                    ) : (
                        <div style={{ height: "100%", overflowY: "auto", padding: "24px" }}>
                            <div style={{ position: "relative" }}>
                                {history.length > 0 && <div style={{ position: "absolute", left: 17, top: 0, bottom: 0, width: 2, background: "var(--border)", zIndex: 0 }} />}
                                {history.map((h) => {
                                    const info = getActionDisplayInfo(h.Action);
                                    let meta: any = {};
                                    try { meta = h.MetadataJson ? JSON.parse(h.MetadataJson) : {}; } catch { }
                                    return (
                                        <div key={h.HistoryId} style={{ display: "flex", gap: 14, marginBottom: 20, position: "relative", zIndex: 1 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg-secondary)", border: `2px solid ${info.color}`, display: "flex", alignItems: "center", justifyContent: "center", color: info.color, flexShrink: 0 }}>
                                                {info.icon}
                                            </div>
                                            <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--border)" }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{info.label}</span>
                                                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{formatDateTime(h.CreatedAt)}</span>
                                                </div>
                                                <div style={{ marginTop: 6, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                                                    {h.ActorUserId && <span>Por: <strong>{h.ActorName || h.ActorEmail}</strong></span>}
                                                    {h.EscalatedToEmail && <span> → Escalado para: <strong>{h.EscalatedToEmail}</strong></span>}
                                                    {meta.newStatus && <span> · Novo status: <strong>{meta.newStatus}</strong></span>}
                                                </div>
                                                {(meta.text || meta.body) && (
                                                    <div style={{ 
                                                        marginTop: 10, 
                                                        padding: "10px 14px", 
                                                        background: h.Action === 'COMMENTED' ? "rgba(155,89,182,0.05)" : "rgba(0,0,0,0.03)", 
                                                        borderRadius: 8, 
                                                        fontSize: "0.85rem",
                                                        color: "var(--text-primary)",
                                                        borderLeft: h.Action === 'COMMENTED' ? "3px solid #9b59b6" : "none",
                                                        whiteSpace: "pre-wrap"
                                                    }}>
                                                        {meta.text || meta.body}
                                                    </div>
                                                )}
                                                {h.Action === 'CLOSED' && meta.resolution && (
                                                    <div style={{ 
                                                        marginTop: 10, 
                                                        padding: "10px 14px", 
                                                        background: "rgba(0, 168, 132, 0.05)", 
                                                        borderRadius: 8, 
                                                        fontSize: "0.85rem",
                                                        color: "var(--text-primary)",
                                                        borderLeft: "3px solid #00a884",
                                                        whiteSpace: "pre-wrap"
                                                    }}>
                                                        <strong>Resolução:</strong> {meta.resolution}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {activeTab === "TIMELINE" && role !== 'END_USER' && (
                    <div style={{ 
                        padding: "12px 20px", 
                        borderTop: "1px solid var(--border)", 
                        background: "var(--bg-secondary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 12
                    }}>
                        <button onClick={loadCannedResponses} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }} title="Respostas Rápidas">
                            <Zap size={20} />
                        </button>
                        <button onClick={loadKbArticles} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }} title="Base de Conhecimento">
                            <BookOpen size={20} />
                        </button>
                        <div style={{ flex: 1, position: "relative" }}>
                            {showCannedMenu && (
                                <div style={{ 
                                    position: "absolute", 
                                    bottom: "100%", 
                                    left: -60, 
                                    width: 300, 
                                    background: "var(--bg-secondary)", 
                                    border: "1px solid var(--border)", 
                                    borderRadius: 12, 
                                    boxShadow: "0 -10px 25px rgba(0,0,0,0.15)",
                                    marginBottom: 10,
                                    zIndex: 100,
                                    maxHeight: 200,
                                    overflowY: "auto"
                                }}>
                                    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>RESPOSTAS RÁPIDAS</div>
                                    {cannedResponses.map(c => (
                                        <div 
                                            key={c.CannedId} 
                                            onClick={() => { setComment(comment + c.Content); setShowCannedMenu(false); }}
                                            style={{ padding: "10px 14px", cursor: "pointer", fontSize: "0.82rem", borderBottom: "1px solid var(--border)" }}
                                            className="table-row-hover"
                                        >
                                            <div style={{ fontWeight: 600 }}>{c.Shortcut}</div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.Content}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <input 
                                placeholder="Adicionar comentário..." 
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                                style={{ 
                                    width: "100%", 
                                    padding: "10px 16px", 
                                    borderRadius: 10, 
                                    border: "1px solid var(--border)", 
                                    background: "var(--bg-primary)",
                                    color: "var(--text-primary)",
                                    fontSize: "0.85rem",
                                    outline: "none"
                                }}
                            />
                        </div>
                        <button 
                            onClick={handleSendComment}
                            disabled={!comment.trim() || actionLoading}
                            style={{ 
                                background: "var(--accent)", 
                                color: "#fff", 
                                border: "none", 
                                width: 36, 
                                height: 36, 
                                borderRadius: 10, 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center",
                                cursor: "pointer",
                                opacity: (!comment.trim() || actionLoading) ? 0.6 : 1
                            }}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* Direita: Sidebar de Metadados e Ações */}
            <div style={{ width: 340, display: "flex", flexDirection: "column", background: "var(--bg-secondary)", borderLeft: "1px solid var(--border)" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                    
                    {/* Status & SLA Section */}
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <h3 style={{ margin: 0, fontSize: "0.75rem", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px" }}>Status do Chamado</h3>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <span style={{
                                padding: "6px 12px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 800,
                                background: ["OPEN", "NEW", "TRIAGE", "IN_PROGRESS", "ESCALATED"].includes(ticket.Status) ? "rgba(0,168,132,0.12)" : "rgba(134,150,160,0.12)",
                                color: ["OPEN", "NEW", "TRIAGE", "IN_PROGRESS", "ESCALATED"].includes(ticket.Status) ? "#00a884" : "#8696a0",
                                border: `1px solid ${["OPEN", "NEW", "TRIAGE", "IN_PROGRESS", "ESCALATED"].includes(ticket.Status) ? "rgba(0,168,132,0.2)" : "rgba(134,150,160,0.2)"}`
                            }}>
                                {{ "NEW": "Novo", "OPEN": "Aberto", "TRIAGE": "Triagem", "IN_PROGRESS": "Atendimento", "WAITING_CUSTOMER": "Aguard. cliente", "RESOLVED": "Resolvido", "CLOSED": "Fechado" }[ticket.Status] || ticket.Status}
                            </span>
                            {ticket.SlaStatus && (
                                <span style={{
                                    padding: "6px 12px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 800,
                                    background: ticket.SlaStatus === 'BREACHED' ? "rgba(239,68,68,0.12)" : ticket.SlaStatus === 'WARNING' ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)",
                                    color: ticket.SlaStatus === 'BREACHED' ? "#ef4444" : ticket.SlaStatus === 'WARNING' ? "#f59e0b" : "#10b981",
                                    border: `1px solid ${ticket.SlaStatus === 'BREACHED' ? "rgba(239,68,68,0.2)" : ticket.SlaStatus === 'WARNING' ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`
                                }}>
                                    <Timer size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                                    SLA {ticket.SlaStatus}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Requester Section */}
                    <div style={{ marginBottom: 24, padding: 16, background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)" }}>
                        <h3 style={{ margin: "0 0 12px", fontSize: "0.75rem", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase" }}>Solicitante</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                                {(ticket.ContactName || "?").charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.ContactName || "Sem nome"}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                                    <Phone size={10} /> {formatWhatsApp(ticket.ExternalUserId || "")}
                                </div>
                            </div>
                        </div>
                    </div>

                    {ticket.Status === 'RESOLVED' && ticket.ResolutionDescription && (
                        <div style={{ marginBottom: 24, padding: 16, background: "rgba(0,168,132,0.05)", borderRadius: 12, border: "1px solid rgba(0,168,132,0.2)" }}>
                            <h3 style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 800, color: "#00a884", textTransform: "uppercase" }}>Resolução</h3>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
                                {ticket.ResolutionDescription}
                            </div>
                        </div>
                    )}

                    {/* Metadata List */}
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{ margin: "0 0 12px", fontSize: "0.75rem", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase" }}>Atribuição</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Técnico:</span>
                                <span style={{ fontWeight: 600 }}>{ticket.AssignedUserName || "—"}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Prioridade:</span>
                                <span style={{ fontWeight: 700, color: ticket.Priority === "CRITICAL" ? "#ef4444" : "inherit" }}>{ticket.Priority}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions Area */}
                    <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
                        {canEscalate && ticket.Status !== "RESOLVED" && (
                            <button onClick={openEscalateModal} className="btn" style={{ width: "100%", justifyContent: "center", gap: 8, background: "rgba(230,126,34,0.1)", color: "#e67e22", border: "1px solid rgba(230,126,34,0.2)", padding: "10px" }}>
                                <ArrowUpRight size={16} /> Escalar Chamado
                            </button>
                        )}
                        {canClose && ticket.Status !== "RESOLVED" && (
                            <button onClick={() => setShowCloseConfirm(true)} className="btn" style={{ width: "100%", justifyContent: "center", gap: 8, background: "rgba(134,150,160,0.1)", color: "#8696a0", border: "1px solid rgba(134,150,160,0.2)", padding: "10px" }}>
                                <CheckCircle size={16} /> Resolver Chamado
                            </button>
                        )}
                        {ticket.Status === "RESOLVED" && (
                            <button onClick={handleReopen} className="btn" style={{ width: "100%", justifyContent: "center", gap: 8, background: "rgba(0,168,132,0.1)", color: "#00a884", border: "1px solid rgba(0,168,132,0.2)", padding: "10px" }}>
                                <RefreshCw size={16} /> Reabrir Chamado
                            </button>
                        )}
                        {ticket.Status === "RESOLVED" && (
                            <button onClick={openSaveToKB} className="btn" style={{ width: "100%", justifyContent: "center", gap: 8, background: "rgba(155,89,182,0.1)", color: "#9b59b6", border: "1px solid rgba(155,89,182,0.2)", padding: "10px" }}>
                                <BookOpen size={16} /> Salvar na Base
                            </button>
                        )}
                        {hasLogAccess && (
                            <button onClick={openAuditLog} className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", gap: 8, padding: "10px" }}>
                                <ShieldAlert size={16} /> Log de Auditoria
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals (Escalate, Audit, Confirm, KB) */}
            {showEscalateModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", width: "100%", maxWidth: 400, padding: 28, borderRadius: 16, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Escalar Chamado</h3>
                            <button onClick={() => setShowEscalateModal(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><X size={20} /></button>
                        </div>
                        <div style={{ maxHeight: 250, overflowY: "auto" }}>
                            {users.map(u => (
                                <div key={u.UserId} onClick={() => handleEscalate(u.UserId)} style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--border)", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }} className="table-row-hover">
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><User size={16} /></div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{u.AgentName || u.Name || u.Email}</div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{u.Email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showAuditModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", width: "100%", maxWidth: 550, padding: 28, borderRadius: 16, maxHeight: "70vh", boxShadow: "0 20px 40px rgba(0,0,0,0.4)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>📋 Log de Auditoria</h3>
                            <button onClick={() => setShowAuditModal(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><X size={20} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {auditLogs.map((log, i) => (
                                <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <strong style={{ color: "var(--accent)" }}>{log.action}</strong>
                                        <span style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>{formatDateTime(log.time)}</span>
                                    </div>
                                    <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>Ator: {log.actor} {log.meta && <span> · {JSON.stringify(log.meta)}</span>}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showCloseConfirm && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", width: "100%", maxWidth: 450, padding: 28, borderRadius: 16, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Resolver Chamado</h3>
                            <button onClick={() => setShowCloseConfirm(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 16 }}>
                            Deseja realmente marcar este chamado como resolvido? Por favor, descreva como o problema foi resolvido.
                        </p>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.82rem", fontWeight: 600 }}>Descrição da Resolução</label>
                            <textarea
                                value={resolutionDescription}
                                onChange={e => setResolutionDescription(e.target.value)}
                                placeholder="Descreva como o problema foi resolvido..."
                                rows={4}
                                style={{
                                    width: "100%",
                                    padding: 12,
                                    borderRadius: 10,
                                    border: "1px solid var(--border)",
                                    background: "var(--bg-primary)",
                                    color: "var(--text-primary)",
                                    fontSize: "0.88rem",
                                    outline: "none",
                                    resize: "none",
                                    boxSizing: "border-box"
                                }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                            <button
                                onClick={() => { setShowCloseConfirm(false); setResolutionDescription(""); }}
                                className="btn btn-ghost"
                                style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer" }}
                                disabled={actionLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleClose}
                                className="btn btn-primary"
                                style={{ flex: 1, padding: "10px 16px", borderRadius: 10, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}
                                disabled={!resolutionDescription.trim() || actionLoading}
                            >
                                {actionLoading ? "Resolvendo..." : "Confirmar Resolução"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showKBModal && (
                <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 25, borderRadius: 10, width: 700, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h3 style={{ margin: 0 }}>Base de Conhecimento</h3>
                            <button onClick={() => setShowKBModal(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><RotateCcw size={18} /></button>
                        </div>
                        <div style={{ position: "relative", marginBottom: 15 }}>
                            <Search style={{ position: "absolute", left: 12, top: 10, color: "#8696a0" }} size={18} />
                            <input placeholder="Buscar artigos..." value={kbSearch} onChange={e => setKbSearch(e.target.value)} style={{ width: "100%", padding: "10px 10px 10px 40px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                            {kbArticles.filter(a => a.Title.toLowerCase().includes(kbSearch.toLowerCase())).map(article => (
                                <div key={article.ArticleId} style={{ padding: 15, border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer" }} className="table-row-hover" onClick={() => { setComment(comment + article.Content.replace(/<[^>]*>?/gm, '')); setShowKBModal(false); }}>
                                    <div style={{ fontWeight: 600, color: "var(--accent)", fontSize: "0.8rem" }}>{article.Category || "Geral"}</div>
                                    <div style={{ fontWeight: 700, fontSize: "1rem", margin: "4px 0" }}>{article.Title}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showSaveToKB && (
                <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 25, borderRadius: 12, width: 500 }}>
                        <h3 style={{ marginTop: 0 }}>Salvar na Base de Conhecimento</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 20 }}>
                            <input value={kbForm.title} onChange={e => setKbForm({ ...kbForm, title: e.target.value })} placeholder="Título" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }} />
                            <textarea value={kbForm.content} onChange={e => setKbForm({ ...kbForm, content: e.target.value })} rows={6} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", resize: "vertical" }} />
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 25 }}>
                            <button onClick={() => setShowSaveToKB(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                            <button onClick={handleSaveToKB} className="btn btn-primary" style={{ flex: 1 }} disabled={actionLoading}>Salvar Artigo</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer History Sliding Drawer */}
            {showHistoryDrawer && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={() => setShowHistoryDrawer(false)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0,0,0,0.5)",
                            backdropFilter: "blur(4px)",
                            zIndex: 9998
                        }}
                    />

                    {/* Drawer Content */}
                    <aside
                        style={{
                            position: "fixed",
                            top: 0,
                            right: 0,
                            height: "100%",
                            width: "min(400px, 100vw)",
                            zIndex: 9999,
                            display: "flex",
                            flexDirection: "column",
                            background: "var(--bg-secondary)",
                            color: "var(--text-primary)",
                            borderLeft: "1px solid var(--border)",
                            boxShadow: "-8px 0 40px rgba(0, 0, 0, 0.3)",
                            transform: "translateX(0)",
                            transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)"
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: "20px 24px",
                            borderBottom: "1px solid var(--border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "var(--bg-primary)",
                            flexShrink: 0
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>Histórico do Cliente</h3>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    {ticket.ContactName || "Cliente"}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowHistoryDrawer(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-secondary)",
                                    cursor: "pointer",
                                    padding: 4,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "background-color 0.2s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-primary)"}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                                title="Fechar histórico"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* List Area */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                            {loadingHistoryTickets && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
                                    <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
                                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Buscando histórico...</span>
                                </div>
                            )}
                            {!loadingHistoryTickets && historyTickets.length === 0 && (
                                <div style={{ textAlign: "center", padding: 30, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                    Nenhum outro chamado encontrado para este cliente.
                                </div>
                            )}
                            {!loadingHistoryTickets && historyTickets.map(t => (
                                <div
                                    key={t.ConversationId}
                                    onClick={() => {
                                        if (onSelectTicket) {
                                            onSelectTicket(t);
                                        }
                                        setShowHistoryDrawer(false);
                                    }}
                                    style={{
                                        padding: 14,
                                        borderRadius: 10,
                                        border: "1px solid var(--border)",
                                        marginBottom: 12,
                                        cursor: "pointer",
                                        background: "var(--bg-secondary)",
                                        transition: "all 0.15s ease"
                                    }}
                                    className="table-row-hover"
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                                            {t.Title || "Sem assunto"}
                                        </span>
                                        <span style={{
                                            padding: "2px 8px", borderRadius: 6, fontSize: "0.65rem", fontWeight: 700,
                                            background: t.Status === 'RESOLVED' ? "rgba(134,150,160,0.12)" : "rgba(0,168,132,0.12)",
                                            color: t.Status === 'RESOLVED' ? "#8696a0" : "#00a884"
                                        }}>
                                            {t.Status === 'RESOLVED' ? 'Fechado' : 'Aberto'}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                        <span>#{t.id?.substring(0, 8)}...</span>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                                            <span>Aberto em: {formatDateTime(t.CreatedAt)}</span>
                                            {t.Status === 'RESOLVED' && t.ClosedAt && (
                                                <span style={{ color: "var(--text-tertiary)" }}>Fechado em: {formatDateTime(t.ClosedAt)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                </>
            )}
        </div>
    );
}
