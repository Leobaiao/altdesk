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
    Send
} from "lucide-react";
import { api } from "../lib/api";
import type { TicketData } from "./TicketList";

interface HistoryEntry {
    HistoryId: string;
    SequenceNumber: number;
    Action: string;
    ActorUserId: string | null;
    EscalatedToUserId: string | null;
    MetadataJson: string | null;
    CreatedAt: string;
    ActorEmail: string | null;
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
    onTicketUpdate: () => void;
}

export function TicketDetail({ ticket, onBack, profile, onTicketUpdate }: TicketDetailProps) {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEscalateModal, setShowEscalateModal] = useState(false);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [comment, setComment] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

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

    useEffect(() => { loadHistory(); }, [ticket.ConversationId]);

    const canEscalate = profile?.CanEscalate || profile?.Role === "ADMIN" || profile?.Role === "SUPERADMIN";
    const canClose = profile?.CanClose || profile?.Role === "ADMIN" || profile?.Role === "SUPERADMIN";
    const canComment = profile?.CanComment !== false; // default true
    const hasLogAccess = profile?.HasLogAccess || profile?.Role === "ADMIN" || profile?.Role === "SUPERADMIN";

    async function handleClose() {
        if (!confirm("Deseja realmente fechar este chamado?")) return;
        setActionLoading(true);
        try {
            await api.post(`/api/conversations/${ticket.ConversationId}/status`, { status: "RESOLVED" });
            onTicketUpdate();
            loadHistory();
        } catch (e: any) {
            alert("Erro ao fechar chamado: " + (e.response?.data?.error || e.message));
        } finally {
            setActionLoading(false);
        }
    }

    async function handleReopen() {
        setActionLoading(true);
        try {
            await api.post(`/api/conversations/${ticket.ConversationId}/status`, { status: "OPEN" });
            onTicketUpdate();
            loadHistory();
        } catch (e: any) {
            alert("Erro ao reabrir chamado: " + (e.response?.data?.error || e.message));
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
            alert("Erro ao escalar: " + (e.response?.data?.error || e.message));
        } finally {
            setActionLoading(false);
        }
    }

    async function openEscalateModal() {
        try {
            const res = await api.get<UserOption[]>("/api/users");
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error(e);
        }
        setShowEscalateModal(true);
    }

    async function openAuditLog() {
        // For now just show the conversation history as audit info
        setAuditLogs(history.map(h => ({
            action: h.Action,
            actor: h.ActorEmail || "Sistema",
            time: h.CreatedAt,
            meta: h.MetadataJson ? JSON.parse(h.MetadataJson) : null
        })));
        setShowAuditModal(true);
    }

    async function handleComment() {
        if (!comment.trim()) return;
        setActionLoading(true);
        try {
            // Send as a reply (demo internal message)
            await api.post(`/api/conversations/demo/${ticket.ConversationId}/messages`, { text: `[COMENTÁRIO] ${comment}` });
            setComment("");
            loadHistory();
        } catch (e: any) {
            alert("Erro ao comentar: " + (e.response?.data?.error || e.message));
        } finally {
            setActionLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* Header */}
            <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-secondary)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={onBack} className="btn btn-ghost" style={{ padding: 8, borderRadius: "50%" }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                            {ticket.ContactName || ticket.ExternalUserId || "Chamado"}
                        </h2>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            <span>CPF: {ticket.ContactCPF || "N/I"}</span>
                            <span>·</span>
                            <span>Atendente: {ticket.AssignedUserName || ticket.AssignedUserEmail || "Não atribuído"}</span>
                            <span>·</span>
                            <span style={{
                                padding: "2px 8px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 700,
                                background: ticket.Status === "OPEN" ? "rgba(0,168,132,0.12)" : "rgba(134,150,160,0.12)",
                                color: ticket.Status === "OPEN" ? "#00a884" : "#8696a0"
                            }}>
                                {ticket.Status === "OPEN" ? "Aberto" : ticket.Status === "RESOLVED" ? "Fechado" : ticket.Status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    {canEscalate && ticket.Status !== "RESOLVED" && (
                        <button onClick={openEscalateModal} className="btn" disabled={actionLoading} style={{
                            padding: "8px 14px", borderRadius: 10, border: "1px solid #e67e22",
                            background: "rgba(230,126,34,0.08)", color: "#e67e22", fontWeight: 600, fontSize: "0.8rem",
                            display: "flex", alignItems: "center", gap: 6, cursor: "pointer"
                        }}>
                            <ArrowUpRight size={14} /> Escalar
                        </button>
                    )}
                    {canClose && ticket.Status !== "RESOLVED" && (
                        <button onClick={handleClose} className="btn" disabled={actionLoading} style={{
                            padding: "8px 14px", borderRadius: 10, border: "1px solid #8696a0",
                            background: "rgba(134,150,160,0.08)", color: "#8696a0", fontWeight: 600, fontSize: "0.8rem",
                            display: "flex", alignItems: "center", gap: 6, cursor: "pointer"
                        }}>
                            <CheckCircle size={14} /> Fechar Ticket
                        </button>
                    )}
                    {ticket.Status === "RESOLVED" && (
                        <button onClick={handleReopen} className="btn" disabled={actionLoading} style={{
                            padding: "8px 14px", borderRadius: 10, border: "1px solid #00a884",
                            background: "rgba(0,168,132,0.08)", color: "#00a884", fontWeight: 600, fontSize: "0.8rem",
                            display: "flex", alignItems: "center", gap: 6, cursor: "pointer"
                        }}>
                            <RefreshCw size={14} /> Reabrir
                        </button>
                    )}
                    {hasLogAccess && (
                        <button onClick={openAuditLog} className="btn" style={{
                            padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)",
                            background: "transparent", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.8rem",
                            display: "flex", alignItems: "center", gap: 6, cursor: "pointer"
                        }}>
                            <FileText size={14} /> Log de Auditoria
                        </button>
                    )}
                </div>
            </div>

            {/* Timeline */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Linha do Tempo · {history.length} interações
                </h3>

                {loading && (
                    <div style={{ padding: 30, textAlign: "center" }}>
                        <div className="spinner" style={{ margin: "0 auto" }}></div>
                    </div>
                )}

                {!loading && history.length === 0 && (
                    <div style={{ padding: 30, textAlign: "center", color: "var(--text-secondary)" }}>
                        Nenhuma interação registrada.
                    </div>
                )}

                <div style={{ position: "relative" }}>
                    {/* Vertical line */}
                    {history.length > 0 && (
                        <div style={{
                            position: "absolute", left: 17, top: 0, bottom: 0, width: 2,
                            background: "var(--border)", zIndex: 0
                        }} />
                    )}

                    {history.map((h, i) => {
                        const info = getActionDisplayInfo(h.Action);
                        let meta: Record<string, any> = {};
                        try { meta = h.MetadataJson ? JSON.parse(h.MetadataJson) : {}; } catch { }

                        return (
                            <div key={h.HistoryId} style={{
                                display: "flex", gap: 14, marginBottom: 20, position: "relative", zIndex: 1
                            }}>
                                {/* Dot */}
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: "var(--bg-secondary)", border: `2px solid ${info.color}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: info.color, flexShrink: 0
                                }}>
                                    {info.icon}
                                </div>

                                {/* Card */}
                                <div style={{
                                    flex: 1, background: "var(--bg-secondary)", borderRadius: 12,
                                    padding: "12px 16px", border: "1px solid var(--border)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{
                                                fontWeight: 800, fontSize: "0.85rem", color: info.color,
                                                background: `${info.color}15`, padding: "2px 8px", borderRadius: 6
                                            }}>
                                                #{h.SequenceNumber}
                                            </span>
                                            <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{info.label}</span>
                                        </div>
                                        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                            {formatDateTime(h.CreatedAt)}
                                        </span>
                                    </div>

                                    <div style={{ marginTop: 6, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                                        {h.ActorEmail && <span>Por: <strong>{h.ActorEmail}</strong></span>}
                                        {h.EscalatedToEmail && <span> → Escalado para: <strong>{h.EscalatedToEmail}</strong></span>}
                                        {meta.direction && <span> · Direção: {meta.direction === "IN" ? "Entrada" : "Saída"}</span>}
                                        {meta.newStatus && <span> · Novo status: <strong>{meta.newStatus}</strong></span>}
                                        {meta.source && <span> · Canal: {meta.source}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Comment box */}
            {canComment && ticket.Status !== "RESOLVED" && (
                <div style={{
                    padding: "12px 24px", borderTop: "1px solid var(--border)",
                    display: "flex", gap: 10, alignItems: "center"
                }}>
                    <input
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Adicionar comentário..."
                        onKeyDown={e => e.key === "Enter" && handleComment()}
                        style={{
                            flex: 1, padding: "10px 14px", borderRadius: 10,
                            background: "var(--bg-primary)", border: "1px solid var(--border)",
                            color: "var(--text-primary)", fontSize: "0.88rem"
                        }}
                    />
                    <button onClick={handleComment} disabled={actionLoading || !comment.trim()} className="btn btn-primary" style={{ padding: "10px 16px", borderRadius: 10 }}>
                        <Send size={16} />
                    </button>
                </div>
            )}

            {/* Escalate Modal */}
            {showEscalateModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--bg-secondary)", border: "1px solid var(--border)",
                        width: "100%", maxWidth: 400, padding: 28, borderRadius: 16,
                        boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Escalar Chamado</h3>
                            <button onClick={() => setShowEscalateModal(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 16 }}>
                            Selecione o técnico/supervisor para escalar este chamado:
                        </p>
                        <div style={{ maxHeight: 250, overflowY: "auto" }}>
                            {users.map(u => (
                                <div
                                    key={u.UserId}
                                    onClick={() => handleEscalate(u.UserId)}
                                    style={{
                                        padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                                        border: "1px solid var(--border)", marginBottom: 8,
                                        display: "flex", alignItems: "center", gap: 10,
                                        transition: "background 0.15s"
                                    }}
                                    className="table-row-hover"
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: "var(--bg-primary)", display: "flex",
                                        alignItems: "center", justifyContent: "center"
                                    }}>
                                        <User size={16} />
                                    </div>
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

            {/* Audit Log Modal */}
            {showAuditModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--bg-secondary)", border: "1px solid var(--border)",
                        width: "100%", maxWidth: 550, padding: 28, borderRadius: 16, maxHeight: "70vh",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.4)", overflow: "hidden", display: "flex", flexDirection: "column"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>📋 Log de Auditoria</h3>
                            <button onClick={() => setShowAuditModal(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {auditLogs.map((log, i) => (
                                <div key={i} style={{
                                    padding: "10px 14px", borderBottom: "1px solid var(--border)",
                                    fontSize: "0.82rem"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <strong style={{ color: "var(--accent)" }}>{log.action}</strong>
                                        <span style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>{formatDateTime(log.time)}</span>
                                    </div>
                                    <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                                        Ator: {log.actor}
                                        {log.meta && <span> · {JSON.stringify(log.meta)}</span>}
                                    </div>
                                </div>
                            ))}
                            {auditLogs.length === 0 && (
                                <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20 }}>Nenhum registro de auditoria.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
