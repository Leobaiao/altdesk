import React, { useState } from "react";
import {
    Users as UsersIcon,
    Smartphone,
    Globe
} from "lucide-react";

import { TenantsTab } from "./components/SuperAdmin/TenantsTab";
import { UsersTab } from "./components/SuperAdmin/UsersTab";
import { InstancesTab } from "./components/SuperAdmin/InstancesTab";

export function SuperAdmin({ token, onBack }: { token: string; onBack: () => void }) {
    const [tab, setTab] = useState<"tenants" | "users" | "instances">("tenants");

    return (
        <div className="settings-page">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.1rem", display: "flex", alignItems: "center", transition: "color 0.2s" }} className="hover-accent">
                    ← <span style={{ marginLeft: 4 }}>Voltar</span>
                </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>🏢 Super Admin</h1>
            </div>

            <div style={{ display: "flex", gap: 32, marginBottom: 32, borderBottom: "1px solid var(--border)" }}>
                {[
                    { id: "tenants", label: "Empresas", icon: <Globe size={18} /> },
                    { id: "users", label: "Usuários", icon: <UsersIcon size={18} /> },
                    { id: "instances", label: "Instâncias", icon: <Smartphone size={18} /> }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id as any)}
                        style={{
                            padding: "12px 4px",
                            background: "none",
                            border: "none",
                            color: tab === t.id ? "var(--accent)" : "var(--text-secondary)",
                            borderBottom: tab === t.id ? "3px solid var(--accent)" : "3px solid transparent",
                            cursor: "pointer",
                            fontSize: "1rem",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            transition: "all 0.2s"
                        }}
                    >
                        <span>{t.icon}</span> {t.label}
                    </button>
                ))}
            </div>

            {tab === "tenants" && <TenantsTab onShowModalChange={() => { }} />}
            {tab === "users" && <UsersTab />}
            {tab === "instances" && <InstancesTab />}
        </div>
    );
}
