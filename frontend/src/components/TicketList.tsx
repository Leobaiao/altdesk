import React, { useEffect, useState, useMemo } from "react";
import {
    MessageSquare as WhatsAppIcon,
    Monitor,
    Bot,
    Filter,
    Search,
    ArrowLeft,
    RefreshCw
} from "lucide-react";
import { api } from "../lib/api";

export interface TicketData {
    ConversationId: string;
    Title: string;
    Status: string;
    Kind: string;
    LastMessageAt: string;
    CreatedAt: string;
    QueueId: string | null;
    AssignedUserId: string | null;
    SourceChannel: string | null;
    InteractionSequence: number;
    ExternalUserId: string;
    QueueName: string | null;
    AssignedUserName: string | null;
    AssignedUserEmail: string | null;
    ContactName: string | null;
    ContactCPF: string | null;
    ContactPhone: string | null;
    UnreadCount: number;
}

function getChannelIcon(channel: string | null) {
    const ch = (channel || "").toUpperCase();
    if (ch.includes("WHATSAPP")) return <WhatsAppIcon size={16} />;
    if (ch.includes("CHATBOT") || ch.includes("BOT")) return <Bot size={16} />;
    return <Monitor size={16} />;
}

function getChannelLabel(channel: string | null) {
    const ch = (channel || "").toUpperCase();
    if (ch.includes("WHATSAPP")) return "WhatsApp";
    if (ch.includes("CHATBOT") || ch.includes("BOT")) return "Chatbot";
    if (ch.includes("EMAIL")) return "Email";
    if (ch.includes("RCS")) return "RCS";
    if (ch.includes("SMS")) return "SMS";
    return "Plataforma";
}

function getStatusBadge(status: string) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
        OPEN: { label: "Aberto", color: "#00a884", bg: "rgba(0,168,132,0.12)" },
        RESOLVED: { label: "Fechado", color: "#8696a0", bg: "rgba(134,150,160,0.12)" },
        PENDING: { label: "Pendente", color: "#f1c40f", bg: "rgba(241,196,15,0.12)" },
        SNOOZED: { label: "Pausado", color: "#9b59b6", bg: "rgba(155,89,182,0.12)" },
    };
    const s = map[status] || { label: status, color: "#8696a0", bg: "rgba(134,150,160,0.12)" };
    return (
        <span style={{
            padding: "4px 10px", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700,
            background: s.bg, color: s.color, letterSpacing: "0.3px"
        }}>
            {s.label}
        </span>
    );
}

function formatDate(d: string) {
    if (!d) return "—";
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Agora";
    if (mins < 60) return `${mins}m atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatCPF(cpf: string | null) {
    if (!cpf) return "—";
    const clean = cpf.replace(/\D/g, "");
    if (clean.length === 11) {
        return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
    }
    return cpf;
}

interface TicketListProps {
    onSelect: (ticket: TicketData) => void;
    selectedId: string | null;
    onBack: () => void;
}

export function TicketList({ onSelect, selectedId, onBack }: TicketListProps) {
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [channelFilter, setChannelFilter] = useState<string>("ALL");

    async function loadTickets() {
        setLoading(true);
        try {
            const res = await api.get<TicketData[]>("/api/conversations");
            setTickets(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("Error loading tickets:", e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadTickets(); }, []);

    const filtered = useMemo(() => {
        return tickets.filter(t => {
            if (statusFilter !== "ALL" && t.Status !== statusFilter) return false;
            if (channelFilter !== "ALL") {
                const ch = getChannelLabel(t.SourceChannel);
                if (ch !== channelFilter) return false;
            }
            if (search) {
                const s = search.toLowerCase();
                const matchName = (t.ContactName || "").toLowerCase().includes(s);
                const matchCPF = (t.ContactCPF || "").replace(/\D/g, "").includes(s.replace(/\D/g, ""));
                const matchId = t.ConversationId.toLowerCase().includes(s);
                const matchPhone = (t.ContactPhone || "").includes(s);
                if (!matchName && !matchCPF && !matchId && !matchPhone) return false;
            }
            return true;
        });
    }, [tickets, statusFilter, channelFilter, search]);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* Header */}
            <div className="settings-page" style={{ borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <button onClick={onBack} className="btn btn-ghost" style={{ padding: 8, borderRadius: "50%" }} title="Voltar">
                        <ArrowLeft size={22} />
                    </button>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Chamados</h1>
                        <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <button onClick={() => loadTickets()} className="btn btn-ghost" style={{ padding: 8, borderRadius: 10 }} title="Atualizar">
                        <RefreshCw size={18} className={loading ? "spin" : ""} />
                    </button>
                </div>

                {/* Search */}
                <div style={{ position: "relative", marginBottom: 12 }}>
                    <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por CPF, nome ou telefone..."
                        style={{
                            width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
                            background: "var(--bg-primary)", border: "1px solid var(--border)",
                            color: "var(--text-primary)", fontSize: "0.9rem"
                        }}
                    />
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{
                            padding: "6px 12px", borderRadius: 8, background: "var(--bg-primary)",
                            border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "0.8rem", cursor: "pointer"
                        }}
                    >
                        <option value="ALL">Todos Status</option>
                        <option value="OPEN">Aberto</option>
                        <option value="RESOLVED">Fechado</option>
                        <option value="PENDING">Pendente</option>
                    </select>
                    <select
                        value={channelFilter}
                        onChange={e => setChannelFilter(e.target.value)}
                        style={{
                            padding: "6px 12px", borderRadius: 8, background: "var(--bg-primary)",
                            border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "0.8rem", cursor: "pointer"
                        }}
                    >
                        <option value="ALL">Todos Canais</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Plataforma">Plataforma</option>
                        <option value="Chatbot">Chatbot</option>
                    </select>
                </div>
            </div>

            {/* Ticket rows */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {loading && (
                    <div style={{ padding: 40, textAlign: "center" }}>
                        <div className="spinner" style={{ margin: "0 auto" }}></div>
                        <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>Carregando chamados...</p>
                    </div>
                )}
                {!loading && filtered.length === 0 && (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
                        <p>Nenhum chamado encontrado.</p>
                    </div>
                )}
                {!loading && filtered.map(t => (
                    <div
                        key={t.ConversationId}
                        onClick={() => onSelect(t)}
                        style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "12px 24px",
                            cursor: "pointer", borderBottom: "1px solid var(--border)",
                            background: selectedId === t.ConversationId ? "rgba(0,168,132,0.08)" : "transparent",
                            transition: "background 0.15s"
                        }}
                        className="table-row-hover ticket-item-row"
                    >
                        {/* Channel icon */}
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: "var(--bg-primary)", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            color: "var(--text-secondary)", flexShrink: 0
                        }}>
                            {getChannelIcon(t.SourceChannel)}
                        </div>

                        {/* Name & CPF */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {t.ContactName || t.ExternalUserId || "Sem identificação"}
                            </div>
                            <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginTop: 2 }}>
                                CPF: {formatCPF(t.ContactCPF)} · {getChannelLabel(t.SourceChannel)}
                            </div>
                        </div>

                        {/* Assigned */}
                        <div style={{ textAlign: "right", minWidth: 100, flexShrink: 0 }}>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                {t.AssignedUserName || t.AssignedUserEmail || "Sem atendente"}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", opacity: 0.7, marginTop: 2 }}>
                                #{t.InteractionSequence || 0} interações
                            </div>
                        </div>

                        {/* Status + Time */}
                        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
                            {getStatusBadge(t.Status)}
                            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 4 }}>
                                {formatDate(t.LastMessageAt)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
