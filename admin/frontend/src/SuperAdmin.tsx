import React, { useState, useEffect } from "react";
import {
    Users as UsersIcon,
    Smartphone,
    Globe,
    Building2,
    UserCheck,
    Wifi,
    Shield,
    FileText,
    CreditCard,
    Trash2,
    Sun,
    Moon
} from "lucide-react";

import { TenantsTab } from "./components/SuperAdmin/TenantsTab";
import { UsersTab } from "./components/SuperAdmin/UsersTab";
import { InstancesTab } from "./components/SuperAdmin/InstancesTab";
import { AuditTab } from "./components/SuperAdmin/AuditTab";
import { BillingTab } from "./components/SuperAdmin/BillingTab";
import { TrashTab } from "./components/SuperAdmin/TrashTab";
import { api } from "./lib/api";

type Tab = "tenants" | "users" | "instances" | "audit" | "billing" | "trash";

export function SuperAdmin({ token, onBack }: { token: string; onBack: () => void }) {
    const [tab, setTab] = useState<Tab>("tenants");
    const [metrics, setMetrics] = useState<{ tenants: number; users: number; instances: number; trashCount: number } | null>(null);
    const [showMetrics, setShowMetrics] = useState(window.innerWidth > 768);
    const [theme, setTheme] = useState(() => localStorage.getItem("altdesk_admin_theme") || "dark");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("altdesk_admin_theme", theme);
    }, [theme]);

    useEffect(() => {
        loadMetrics();
    }, []);

    const loadMetrics = async () => {
        try {
            const [rT, rU, rI, rTrashT, rTrashU] = await Promise.all([
                api.get("/api/admin/tenants"),
                api.get("/api/admin/users"),
                api.get("/api/admin/instances"),
                api.get("/api/admin/trash/tenants"),
                api.get("/api/admin/trash/users")
            ]);
            setMetrics({
                tenants: Array.isArray(rT.data) ? rT.data.filter((t: any) => t.IsActive).length : 0,
                users: Array.isArray(rU.data) ? rU.data.filter((u: any) => u.IsActive).length : 0,
                instances: Array.isArray(rI.data) ? rI.data.filter((i: any) => i.IsActive).length : 0,
                trashCount: (Array.isArray(rTrashT.data) ? rTrashT.data.length : 0) + (Array.isArray(rTrashU.data) ? rTrashU.data.length : 0)
            });
        } catch (err) {
            console.error("Erro ao carregar métricas:", err);
        }
    };

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "tenants", label: "Empresas", icon: <Globe size={17} /> },
        { id: "users", label: "Usuários", icon: <UsersIcon size={17} /> },
        { id: "instances", label: "Instâncias", icon: <Smartphone size={17} /> },
        { id: "audit", label: "Auditoria", icon: <FileText size={17} /> },
        { id: "billing", label: "Faturamento", icon: <CreditCard size={17} /> },
        { id: "trash", label: "Lixeira", icon: <Trash2 size={17} /> },
    ];

    const METRIC_CARDS = [
        { label: "Empresas Ativas", value: metrics?.tenants ?? "—", icon: <Building2 size={22} />, color: "#4285f4", bg: "rgba(66,133,244,0.12)" },
        { label: "Usuários Ativos", value: metrics?.users ?? "—", icon: <UserCheck size={22} />, color: "#00a884", bg: "rgba(0,168,132,0.12)" },
        { label: "Instâncias Online", value: metrics?.instances ?? "—", icon: <Wifi size={22} />, color: "#ff9800", bg: "rgba(255,152,0,0.12)" },
    ];

    return (
        <div className="settings-page" style={{ paddingTop: 24 }}>
            {/* Back + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
                <button
                    onClick={onBack}
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", padding: "8px 16px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 500, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                    ← Voltar
                </button>

                <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ padding: "8px", background: "rgba(0,168,132,0.15)", borderRadius: 10 }}>
                            <Shield size={22} color="var(--accent)" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>Admin Console</h1>
                            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.82rem" }}>Gestão global de empresas, usuários e instâncias WhatsApp</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} 
                        className="btn btn-ghost"
                        style={{ padding: 10, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="Alternar Tema"
                    >
                        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </div>

            {/* Metric Cards Toggle */}
            <div 
                onClick={() => setShowMetrics(!showMetrics)}
                style={{ 
                    display: "flex", justifyContent: "space-between", alignItems: "center", 
                    marginBottom: showMetrics ? 16 : 28, 
                    cursor: "pointer", background: "var(--bg-secondary)", 
                    padding: "12px 20px", borderRadius: 14, border: "1px solid var(--border)",
                    transition: "all 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>Visão Geral do Sistema</span>
                </div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.5px" }}>
                    {showMetrics ? "OCULTAR ▲" : "MOSTRAR ▼"}
                </span>
            </div>

            {/* Metric Cards */}
            {showMetrics && (
                <div className="admin-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32, animation: "fadeIn 0.2s ease-out" }}>
                    {METRIC_CARDS.map(card => (
                        <div key={card.label} className="admin-metric-card" style={{
                            background: "var(--bg-secondary)", border: "1px solid var(--border)",
                            borderRadius: 14, padding: "20px 24px",
                            display: "flex", alignItems: "center", gap: 16,
                            transition: "all 0.2s"
                        }}>
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", color: card.color, flexShrink: 0 }}>
                                {card.icon}
                            </div>
                            <div>
                                <div className="admin-metric-value" style={{ fontSize: "1.8rem", fontWeight: 800, lineHeight: 1, color: "var(--text-primary)" }}>{card.value}</div>
                                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>{card.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="admin-tabs" style={{ display: "flex", gap: 4, marginBottom: 28, background: "var(--bg-secondary)", padding: 4, borderRadius: 12, border: "1px solid var(--border)", width: "fit-content" }}>
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: "10px 20px",
                            background: tab === t.id ? "var(--accent)" : "transparent",
                            border: "none",
                            color: tab === t.id ? "#fff" : "var(--text-secondary)",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontSize: "0.88rem",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color = "var(--text-primary)"; }}
                        onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color = "var(--text-secondary)"; }}
                    >
                        {t.icon}
                        {t.label}
                        {t.id === "trash" && metrics && metrics.trashCount > 0 && (
                            <div style={{ marginLeft: 4, background: "rgba(255, 0, 0, 0.1)", color: "var(--danger)", padding: "2px 6px", borderRadius: 10, fontSize: "0.75rem", fontWeight: 800 }}>
                                {metrics.trashCount}
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ animation: "fadeIn 0.2s ease-out" }}>
                {tab === "tenants" && <TenantsTab onShowModalChange={() => { }} />}
                {tab === "users" && <UsersTab />}
                {tab === "instances" && <InstancesTab />}
                {tab === "audit" && <AuditTab />}
                {tab === "billing" && <BillingTab />}
                {tab === "trash" && <TrashTab />}
            </div>
        </div>
    );
}
