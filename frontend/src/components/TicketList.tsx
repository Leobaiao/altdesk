import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
    MessageSquare as WhatsAppIcon,
    Monitor,
    Bot,
    Search,
    MailIcon,
    Loader2
} from "lucide-react";
import { api } from "../lib/api";

export interface TicketData {
    id: string;
    conversationId: string;
    ConversationId: string;
    Title: string;
    status: string;
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
    SlaStatus?: string;
    Priority?: string;
    EscalationLevel?: number;
}

function getChannelIcon(channel: string | null) {
    const ch = (channel || "").toUpperCase();
    if (ch.includes("WHATSAPP")) return <WhatsAppIcon size={15} />;
    if (ch.includes("CHATBOT") || ch.includes("BOT")) return <Bot size={15} />;
    if (ch.includes("EMAIL")) return <MailIcon size={15} />;
    return <Monitor size={15} />;
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
        OPEN: { label: "Aberto", color: "#00a884", bg: "rgba(0,168,132,0.1)" },
        RESOLVED: { label: "Fechado", color: "#8696a0", bg: "rgba(134,150,160,0.1)" },
        PENDING: { label: "Pendente", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
        SNOOZED: { label: "Pausado", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
    };
    const s = map[status] || { label: status, color: "#8696a0", bg: "rgba(134,150,160,0.1)" };
    return (
        <span style={{
            padding: "3px 10px", borderRadius: 8, fontSize: "0.7rem", fontWeight: 700,
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
    refreshKey?: number;
    onStatsUpdate?: (stats: { total: number; breached: number; warning: number; onTime: number }) => void;
}

export function TicketList({ onSelect, selectedId, onBack, refreshKey, onStatsUpdate }: TicketListProps) {
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [channelFilter, setChannelFilter] = useState<string>("ALL");

    const loadTickets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<TicketData[]>("/api/conversations");
            const data = Array.isArray(res.data) ? res.data : [];
            setTickets(data);
            if (onStatsUpdate) {
                onStatsUpdate({
                    total: data.length,
                    breached: data.filter(t => t.SlaStatus === 'BREACHED').length,
                    warning: data.filter(t => t.SlaStatus === 'WARNING').length,
                    onTime: data.filter(t => t.SlaStatus === 'ON_TIME').length,
                });
            }
        } catch (e) {
            console.error("Error loading tickets:", e);
        } finally {
            setLoading(false);
        }
    }, [onStatsUpdate]);

    useEffect(() => { loadTickets(); }, [refreshKey, loadTickets]);

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
        <div style={{
            height: "100%", overflowY: "auto", display: "flex", flexDirection: "column",
            background: "var(--bg-primary, #f4f6f8)"
        }}>
            {/* Search + Filters Bar */}
            <div style={{
                padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                background: 'var(--bg-secondary, #fff)',
                borderBottom: '1px solid var(--border, #e5e7eb)'
            }}>
                <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                    <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary, #9ca3af)" }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por CPF, nome ou telefone..."
                        style={{
                            width: "100%", padding: "9px 14px 9px 36px", borderRadius: 10,
                            background: "var(--bg-primary, #f3f4f6)", border: "1px solid var(--border, #e5e7eb)",
                            color: "var(--text-primary, #1f2937)", fontSize: "0.85rem",
                            outline: 'none', transition: 'border-color 0.2s'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{
                        padding: "8px 12px", borderRadius: 10, background: "var(--bg-primary, #f3f4f6)",
                        border: "1px solid var(--border, #e5e7eb)", color: "var(--text-primary, #1f2937)",
                        fontSize: "0.8rem", cursor: "pointer", outline: 'none'
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
                        padding: "8px 12px", borderRadius: 10, background: "var(--bg-primary, #f3f4f6)",
                        border: "1px solid var(--border, #e5e7eb)", color: "var(--text-primary, #1f2937)",
                        fontSize: "0.8rem", cursor: "pointer", outline: 'none'
                    }}
                >
                    <option value="ALL">Todos Canais</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Plataforma">Plataforma</option>
                    <option value="Chatbot">Chatbot</option>
                    <option value="Email">Email</option>
                </select>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', whiteSpace: 'nowrap' }}>
                    {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Ticket rows */}
            <div style={{ flex: 1, overflowY: "auto" }}>
                {loading && (
                    <div style={{ padding: 50, textAlign: "center" }}>
                        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#6366f1', margin: '0 auto' }} />
                        <p style={{ marginTop: 12, color: "var(--text-secondary, #6b7280)", fontSize: '0.85rem' }}>Carregando chamados...</p>
                    </div>
                )}
                {!loading && filtered.length === 0 && (
                    <div style={{ padding: 50, textAlign: "center", color: "var(--text-secondary, #6b7280)" }}>
                        <p style={{ fontSize: '0.9rem' }}>Nenhum chamado encontrado.</p>
                    </div>
                )}
                {!loading && filtered.map(t => (
                    <div
                        key={t.ConversationId}
                        onClick={() => onSelect(t)}
                        style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "14px 20px",
                            cursor: "pointer",
                            borderBottom: "1px solid var(--border, #f3f4f6)",
                            background: selectedId === t.ConversationId
                                ? "rgba(99,102,241,0.06)"
                                : "var(--bg-secondary, #fff)",
                            transition: "all 0.15s ease"
                        }}
                        onMouseEnter={e => {
                            if (selectedId !== t.ConversationId) {
                                (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.03)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (selectedId !== t.ConversationId) {
                                (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary, #fff)';
                            }
                        }}
                    >
                        {/* Channel icon */}
                        <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: "var(--bg-primary, #f3f4f6)", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            color: "var(--text-secondary, #6b7280)", flexShrink: 0
                        }}>
                            {getChannelIcon(t.SourceChannel)}
                        </div>

                        {/* Subject & Name & SLA */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    fontWeight: 600, fontSize: "0.9rem",
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    color: 'var(--text-primary, #1f2937)'
                                }}>
                                    {t.Title || t.ContactName || t.ExternalUserId || "Sem assunto"}
                                </div>
                                {t.SlaStatus && (
                                    <span style={{
                                        fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                                        background: t.SlaStatus === 'BREACHED' ? 'rgba(239,68,68,0.1)' : t.SlaStatus === 'WARNING' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                                        color: t.SlaStatus === 'BREACHED' ? '#dc2626' : t.SlaStatus === 'WARNING' ? '#d97706' : '#059669',
                                        textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0
                                    }}>
                                        {t.SlaStatus === 'BREACHED' ? '⚠ SLA' : t.SlaStatus === 'WARNING' ? '⏳ SLA' : '✓ SLA'}
                                    </span>
                                )}
                            </div>
                            <div style={{ color: "var(--text-secondary, #6b7280)", fontSize: "0.76rem", marginTop: 2 }}>
                                {t.ContactName && t.ContactName !== t.Title ? `${t.ContactName} · ` : ""}
                                {getChannelLabel(t.SourceChannel)}
                            </div>
                        </div>

                        {/* Assigned */}
                        <div style={{ textAlign: "right", minWidth: 90, flexShrink: 0 }}>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary, #6b7280)" }}>
                                {t.AssignedUserName || t.AssignedUserEmail || "Sem atendente"}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary, #6b7280)", opacity: 0.7, marginTop: 2 }}>
                                #{t.InteractionSequence || 0} interações
                            </div>
                        </div>

                        {/* Status + Time */}
                        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
                            {getStatusBadge(t.Status)}
                            <div style={{ fontSize: "0.68rem", color: "var(--text-secondary, #6b7280)", marginTop: 4 }}>
                                {formatDate(t.LastMessageAt)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
