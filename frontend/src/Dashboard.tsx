import React, { useEffect, useState, useMemo } from "react";
import {
    MessageSquareText, Timer, CheckCircle, BarChart3, ArrowLeft,
    Clock, TrendingUp, Star, ShieldCheck, LayoutDashboard
} from "lucide-react";
import { PageHeader } from "./components/PageHeader";
import { api } from "./lib/api";
import { getUserRoleFromToken } from "./lib/auth";
import { useChat } from "./contexts/ChatContext";
import { useNavigate } from "react-router-dom";

type Stats = {
    open: number;
    resolved: number;
    queue: number;
    messagesToday: number;
    avgFirstResponseSeconds: number | null;
    avgResolutionSeconds: number | null;
    avgCsat: number | null;
    csatCount: number;
    slaCompliance: number | null;
    slaMet: number;
    slaViolated: number;
    slaTotal: number;
    hourlyVolume: number[];
    dailyVolume: { day: string; count: number }[];
};

function formatDuration(seconds: number | null): string {
    if (seconds == null || seconds === 0) return "—";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

export function Dashboard({ token, onBack }: { token: string; onBack: () => void }) {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState<any[]>([]);
    const [showNewTicketModal, setShowNewTicketModal] = useState(false);
    const [newTicket, setNewTicket] = useState({ title: "", description: "" });
    const [creating, setCreating] = useState(false);
    const { setSelectedConversationId } = useChat();
    const navigate = useNavigate();

    const handlePortalCreateTicket = async () => {
        if (!newTicket.title || !newTicket.description) return;
        setCreating(true);
        try {
            const res = await api.post("/api/tickets/portal/new", newTicket);
            if (res.data.conversationId) {
                setSelectedConversationId(res.data.conversationId);
                navigate("/chat");
            }
        } catch (e: any) {
            showToast("Erro ao criar chamado: " + (e.response?.data?.error || e.message), "error");
        } finally {
            setCreating(false);
        }
    };

    const { showToast } = useChat();

    const role = useMemo(() => getUserRoleFromToken(), [token]);

    useEffect(() => {
        if (role === 'END_USER') {
            api.get("/api/tickets/kanban")
                .then(r => setTickets(r.data))
                .catch(console.error);
            setLoading(false);
            return;
        }

        api.get<Stats>("/api/dashboard/stats")
            .then(r => {
                setStats(r.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [role]);

    if (loading) return <div style={{ padding: 20, color: "var(--text-primary)" }}>Carregando métricas...</div>;

    // Render logic
    const renderContent = () => {
        if (role === 'END_USER') {
            return (
                <>
                    <PageHeader
                        title="Portal do Solicitante"
                        subtitle="Bem-vindo ao seu painel de suporte. Aqui você pode abrir novos chamados e acompanhar os existentes."
                        icon={LayoutDashboard}
                        onBack={onBack}
                    />

                    <div style={{ padding: "0 20px", marginBottom: 30 }}>
                        <button 
                            className="btn btn-primary" 
                            style={{ 
                                padding: "20px 40px", 
                                fontSize: "1.2rem", 
                                borderRadius: 16, 
                                display: "flex", 
                                alignItems: "center", 
                                gap: 12,
                                boxShadow: "0 10px 20px rgba(0, 168, 132, 0.2)",
                                marginBottom: 40
                            }}
                            onClick={() => setShowNewTicketModal(true)}
                        >
                            <MessageSquareText size={24} />
                            Abrir Novo Chamado
                        </button>

                        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 20, color: "var(--text-secondary)" }}>
                            Meus Chamados
                        </h2>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {tickets.map((t: any) => (
                                <div key={t.id} style={{
                                    background: "var(--bg-secondary)",
                                    padding: "20px",
                                    borderRadius: 16,
                                    border: "1px solid var(--border)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                                onClick={() => {
                                    if (t.conversationId) {
                                        setSelectedConversationId(t.conversationId);
                                        navigate("/chat");
                                    }
                                }}
                                >
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{t.title}</div>
                                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                            Prioridade: <span style={{ fontWeight: 600 }}>{t.priority}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                        <span style={{
                                            padding: "4px 12px",
                                            borderRadius: 8,
                                            fontSize: "0.75rem",
                                            fontWeight: 700,
                                            background: "rgba(0, 168, 132, 0.1)",
                                            color: "var(--accent)"
                                        }}>
                                            {t.status}
                                        </span>
                                        <ArrowLeft style={{ transform: "rotate(180deg)", opacity: 0.5 }} size={20} />
                                    </div>
                                </div>
                            ))}
                            {tickets.length === 0 && (
                                <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", borderRadius: 16 }}>
                                    Você ainda não possui chamados abertos.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            );
        }

        if (!stats) return <div style={{ padding: 20, color: "var(--text-primary)" }}>Erro ao carregar dashboard.</div>;

        const primaryCards = [
            { label: "Conversas Abertas", value: stats.open, color: "#00a884", icon: <MessageSquareText size={28} color="#00a884" /> },
            { label: "Em Fila (Sem Agente)", value: stats.queue, color: "#f1c40f", icon: <Timer size={28} color="#f1c40f" /> },
            { label: "Resolvidas (Total)", value: stats.resolved, color: "#3498db", icon: <CheckCircle size={28} color="#3498db" /> },
            { label: "Mensagens (Hoje)", value: stats.messagesToday, color: "#9b59b6", icon: <BarChart3 size={28} color="#9b59b6" /> },
        ];

        const advancedCards = [
            {
                label: "Tempo Médio 1ª Resposta",
                value: formatDuration(stats.avgFirstResponseSeconds),
                color: "#e67e22",
                icon: <Clock size={28} color="#e67e22" />,
                subtitle: "Últimos 30 dias"
            },
            {
                label: "Tempo Médio Resolução",
                value: formatDuration(stats.avgResolutionSeconds),
                color: "#1abc9c",
                icon: <TrendingUp size={28} color="#1abc9c" />,
                subtitle: "Últimos 30 dias"
            },
            {
                label: "CSAT Médio",
                value: stats.avgCsat != null ? `${stats.avgCsat.toFixed(1)}/5` : "—",
                color: "#f39c12",
                icon: <Star size={28} color="#f39c12" />,
                subtitle: stats.csatCount > 0 ? `${stats.csatCount} avaliações` : "Sem avaliações"
            },
            {
                label: "SLA Cumprido",
                value: stats.slaCompliance != null ? `${stats.slaCompliance}%` : "—",
                color: stats.slaCompliance != null && stats.slaCompliance >= 80 ? "#27ae60" : "#e74c3c",
                icon: <ShieldCheck size={28} color={stats.slaCompliance != null && stats.slaCompliance >= 80 ? "#27ae60" : "#e74c3c"} />,
                subtitle: stats.slaTotal > 0 ? `${stats.slaMet} cumpridos · ${stats.slaViolated} violados` : "Sem dados"
            },
        ];

        const maxHourly = Math.max(...stats.hourlyVolume, 1);

        return (
            <>
                <PageHeader
                    title="Painel de Controle"
                    subtitle="Visão geral da operação em tempo real"
                    icon={LayoutDashboard}
                    onBack={onBack}
                    helpText={
                        <div>
                            <p>O Painel de Controle oferece uma visão panorâmica e em tempo real de toda a sua operação de atendimento.</p>
                            <ul style={{ marginTop: 12, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                                <li><strong>Métricas:</strong> Acompanhe o volume de mensagens, chamados abertos e o tempo médio de resposta.</li>
                                <li><strong>Volume Horário:</strong> Visualize os picos de atendimento para melhor planejar a escala da sua equipe.</li>
                                <li><strong>Canais Ativos:</strong> Monitore quais canais estão gerando mais demanda no momento.</li>
                                <li><strong>Decisões:</strong> Use estes dados para identificar gargalos e otimizar o fluxo de trabalho.</li>
                            </ul>
                        </div>
                    }
                />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 30, padding: "0 20px" }}>
                    {primaryCards.map((c, i) => (
                        <div key={i} style={{
                            background: "var(--bg-secondary)",
                            padding: 20,
                            borderRadius: 12,
                            borderLeft: `4px solid ${c.color}`,
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                        }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 12,
                                background: `${c.color}15`,
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                {c.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>{c.label}</div>
                                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{c.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 30, padding: "0 20px" }}>
                    {advancedCards.map((c, i) => (
                        <div key={i} style={{
                            background: "var(--bg-secondary)",
                            padding: 20,
                            borderRadius: 12,
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 10,
                                    background: `${c.color}15`,
                                    display: "flex", alignItems: "center", justifyContent: "center"
                                }}>
                                    {c.icon}
                                </div>
                                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>{c.value}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>{c.label}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", opacity: 0.7 }}>{c.subtitle}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20, padding: "0 20px", marginBottom: 40 }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 25, borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                        <h3 style={{ margin: "0 0 20px 0", fontSize: "1.1rem" }}>Volume por Hora (Hoje)</h3>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 200, paddingBottom: 20 }}>
                            {stats.hourlyVolume.map((count, i) => (
                                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                                    <div style={{
                                        width: "100%",
                                        height: `${(count / maxHourly) * 100}%`,
                                        minHeight: count > 0 ? 4 : 0,
                                        background: count === maxHourly ? "var(--accent)" : "rgba(0, 168, 132, 0.3)",
                                        borderRadius: "4px 4px 0 0",
                                        transition: "height 0.3s ease"
                                    }} title={`${i}h: ${count} conversas`} />
                                    <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>{i}h</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ background: "var(--bg-secondary)", padding: 25, borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                        <h3 style={{ margin: "0 0 20px 0", fontSize: "1.1rem" }}>Volume Diário (Última Semana)</h3>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 15, height: 200, paddingBottom: 20 }}>
                            {stats.dailyVolume.map((item, i) => {
                                const maxDaily = Math.max(...stats.dailyVolume.map(d => d.count), 1);
                                const height = (item.count / maxDaily) * 100;
                                const dayStr = new Date(item.day).toLocaleDateString("pt-BR", { weekday: "short" });
                                return (
                                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                                        <div style={{
                                            width: "100%",
                                            maxWidth: 60,
                                            height: Math.max(height, 4),
                                            background: "linear-gradient(180deg, #9b59b644, #9b59b6)",
                                            borderRadius: "6px 6px 0 0",
                                            transition: "height 0.3s ease"
                                        }}
                                            title={`${dayStr}: ${item.count} conversas`}
                                        />
                                        <span style={{ fontSize: "0.7em", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                                            {dayStr}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="settings-page" style={{ color: "var(--text-primary)", height: "100%", overflowY: "auto", flex: 1 }}>
            {renderContent()}

            {/* Modal de Novo Chamado */}
            {showNewTicketModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 20, width: "100%", maxWidth: 500, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
                        <h2 style={{ margin: "0 0 10px 0" }}>Abrir Novo Chamado</h2>
                        <p style={{ color: "var(--text-secondary)", marginBottom: 25 }}>Descreva o seu problema ou solicitação abaixo.</p>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <div>
                                <label htmlFor="ticket-title" style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: "0.9rem" }}>Assunto</label>
                                <input 
                                    id="ticket-title"
                                    name="title"
                                    value={newTicket.title}
                                    onChange={e => setNewTicket({...newTicket, title: e.target.value})}
                                    placeholder="Ex: Problema com o acesso ao sistema"
                                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box" }}
                                />
                            </div>
                            <div>
                                <label htmlFor="ticket-desc" style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: "0.9rem" }}>Descrição Detalhada</label>
                                <textarea 
                                    id="ticket-desc"
                                    name="description"
                                    value={newTicket.description}
                                    onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                                    placeholder="Descreva aqui os detalhes da sua solicitação..."
                                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: 120, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                                />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
                            <button 
                                onClick={() => setShowNewTicketModal(false)}
                                style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontWeight: 600 }}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handlePortalCreateTicket}
                                disabled={creating || !newTicket.title || !newTicket.description}
                                style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "var(--accent)", color: "white", cursor: "pointer", fontWeight: 700, opacity: (creating || !newTicket.title || !newTicket.description) ? 0.6 : 1 }}
                            >
                                {creating ? "Enviando..." : "Enviar Chamado"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
