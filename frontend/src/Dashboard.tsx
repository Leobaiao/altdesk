import React, { useEffect, useState } from "react";
import { MessageSquareText, Timer, CheckCircle, BarChart3, ArrowLeft } from "lucide-react";

import { api } from "./lib/api";

type Stats = {
    open: number;
    resolved: number;
    queue: number;
    messagesToday: number;
};

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

    const cards = [
        { label: "Conversas Abertas", value: stats.open, color: "#00a884", icon: <MessageSquareText size={32} color="#00a884" /> },
        { label: "Em Fila (Sem Agente)", value: stats.queue, color: "#f1c40f", icon: <Timer size={32} color="#f1c40f" /> },
        { label: "Resolvidas (Total)", value: stats.resolved, color: "#3498db", icon: <CheckCircle size={32} color="#3498db" /> },
        { label: "Mensagens (Hoje)", value: stats.messagesToday, color: "#9b59b6", icon: <BarChart3 size={32} color="#9b59b6" /> },
    ];

    return (
        <div style={{ padding: 30, color: "var(--text-primary)", overflowY: "auto", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
                <button onClick={onBack} title="Voltar" className="btn icon-btn" style={{ marginRight: 15, background: "transparent", border: "none" }}>
                    <ArrowLeft size={24} color="var(--text-secondary)" />
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Painel de Controle</h1>
                    <p style={{ opacity: 0.7, margin: "5px 0 0 0", fontSize: "0.95rem" }}>Visão geral da operação em tempo real</p>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                {cards.map((c, i) => (
                    <div key={i} className="dashboard-card" style={{
                        background: "var(--bg-secondary)",
                        padding: 25,
                        borderRadius: 12,
                        borderBottom: `4px solid ${c.color}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 20,
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
                    }}>
                        <div style={{
                            background: `${c.color}22`,
                            padding: 15,
                            borderRadius: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            {c.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: "2.2em", fontWeight: "900", color: "var(--text-primary)", lineHeight: 1 }}>{c.value}</div>
                            <div style={{ opacity: 0.8, fontSize: "0.95em", marginTop: 8, color: "var(--text-secondary)", fontWeight: 500 }}>{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Future charts can go here */}
            {/* <div style={{ marginTop: 40, padding: 25, background: "var(--bg-secondary)", borderRadius: 12, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 15px 0" }}>Atividade Recente</h3>
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)", borderRadius: 8 }}>
                    <p style={{ color: "var(--text-secondary)" }}>Gráfico de volume de mensagens (Em breve)</p>
                </div>
            </div> */}
        </div>
    );
}
