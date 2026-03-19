import React, { useEffect, useState } from "react";
import {
    MessageSquareText, Timer, CheckCircle, BarChart3, ArrowLeft,
    Clock, TrendingUp, Star, ShieldCheck
} from "lucide-react";
import { api } from "./lib/api";

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

    useEffect(() => {
        api.get<Stats>("/api/dashboard/stats")
            .then(r => {
                setStats(r.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div style={{ padding: 20, color: "var(--text-primary)" }}>Carregando métricas...</div>;
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
        <div style={{ padding: 30, color: "var(--text-primary)", overflowY: "auto", flex: 1 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
                <button onClick={onBack} title="Voltar" className="btn icon-btn" style={{ marginRight: 15, background: "transparent", border: "none" }}>
                    <ArrowLeft size={24} color="var(--text-secondary)" />
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Painel de Controle</h1>
                    <p style={{ opacity: 0.7, margin: "5px 0 0 0", fontSize: "0.95rem" }}>Visão geral da operação em tempo real</p>
                </div>
            </div>

            {/* Primary Metric Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 30 }}>
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
                            background: `${c.color}18`,
                            padding: 12,
                            borderRadius: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            {c.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: "1.9em", fontWeight: 900, color: "var(--text-primary)", lineHeight: 1 }}>{c.value}</div>
                            <div style={{ opacity: 0.75, fontSize: "0.85em", marginTop: 6, color: "var(--text-secondary)", fontWeight: 500 }}>{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Advanced Metric Cards */}
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 16, color: "var(--text-secondary)" }}>📊 Métricas Avançadas</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 30 }}>
                {advancedCards.map((c, i) => (
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
                            background: `${c.color}18`,
                            padding: 12,
                            borderRadius: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            {c.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: "1.6em", fontWeight: 900, color: "var(--text-primary)", lineHeight: 1 }}>{c.value}</div>
                            <div style={{ opacity: 0.75, fontSize: "0.85em", marginTop: 6, color: "var(--text-secondary)", fontWeight: 500 }}>{c.label}</div>
                            <div style={{ fontSize: "0.7em", marginTop: 3, color: "var(--text-secondary)", opacity: 0.6 }}>{c.subtitle}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Hourly Volume Chart */}
            <div style={{
                background: "var(--bg-secondary)",
                padding: 25,
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                marginBottom: 30
            }}>
                <h3 style={{ margin: "0 0 20px 0", fontSize: "1.05rem", fontWeight: 700 }}>
                    📈 Volume de Mensagens por Hora (Últimas 24h)
                </h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140 }}>
                    {stats.hourlyVolume.map((count, hour) => {
                        const height = maxHourly > 0 ? (count / maxHourly) * 120 : 0;
                        const now = new Date().getHours();
                        const isCurrentHour = hour === now;
                        return (
                            <div key={hour} style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 4
                            }}>
                                {count > 0 && (
                                    <span style={{ fontSize: "0.6em", color: "var(--text-secondary)" }}>{count}</span>
                                )}
                                <div
                                    style={{
                                        width: "100%",
                                        height: Math.max(height, 2),
                                        background: isCurrentHour
                                            ? "linear-gradient(180deg, #00a884, #00c49a)"
                                            : "linear-gradient(180deg, #3498db55, #3498db)",
                                        borderRadius: "4px 4px 0 0",
                                        transition: "height 0.3s ease"
                                    }}
                                    title={`${hour}h: ${count} mensagens`}
                                />
                                <span style={{
                                    fontSize: "0.6em",
                                    color: isCurrentHour ? "#00a884" : "var(--text-secondary)",
                                    fontWeight: isCurrentHour ? 700 : 400
                                }}>
                                    {hour}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Daily Volume */}
            {stats.dailyVolume.length > 0 && (
                <div style={{
                    background: "var(--bg-secondary)",
                    padding: 25,
                    borderRadius: 12,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}>
                    <h3 style={{ margin: "0 0 20px 0", fontSize: "1.05rem", fontWeight: 700 }}>
                        📅 Conversas nos Últimos 7 Dias
                    </h3>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 140 }}>
                        {stats.dailyVolume.map((item, i) => {
                            const maxDaily = Math.max(...stats.dailyVolume.map(d => d.count), 1);
                            const height = (item.count / maxDaily) * 110;
                            const dayStr = new Date(item.day).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
                            return (
                                <div key={i} style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 6
                                }}>
                                    <span style={{ fontSize: "0.8em", fontWeight: 700, color: "var(--text-primary)" }}>{item.count}</span>
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
            )}
        </div>
    );
}
