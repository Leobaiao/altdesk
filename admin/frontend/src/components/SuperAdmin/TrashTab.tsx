import React, { useState, useEffect } from "react";
import { Trash2, RotateCcw, Building, Users } from "lucide-react";
import { api } from "../../lib/api";

export function TrashTab() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<"tenants" | "users">("tenants");

    async function loadTrash() {
        setLoading(true);
        try {
            const [tRes, uRes] = await Promise.all([
                api.get("/api/admin/trash/tenants"),
                api.get("/api/admin/trash/users")
            ]);
            setTenants(tRes.data);
            setUsers(uRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadTrash();
    }, []);

    async function handleRestore(type: "tenants" | "users", id: string) {
        if (!confirm(`Deseja restaurar este ${type === "tenants" ? "tenant" : "usuário"}?`)) return;
        try {
            await api.post(`/api/admin/trash/${type}/${id}/restore`);
            loadTrash();
        } catch (e: any) {
            alert(e.response?.data?.error || "Erro ao restaurar");
        }
    }

    async function handlePermanentDelete(type: "tenants" | "users", id: string) {
        if (!confirm("⚠️ ATENÇÃO: Esta ação é PERMANENTE e não pode ser desfeita. Excluir definitivamente?")) return;
        try {
            await api.delete(`/api/admin/${type}/${id}/permanent`);
            loadTrash();
        } catch (e: any) {
            alert(e.response?.data?.error || "Erro ao excluir permanentemente");
        }
    }

    return (
        <div style={{ padding: 20 }}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold">Lixeira</h2>
                    <p className="text-sm text-gray-500">Recupere ou apague definitivamente itens excluídos</p>
                </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                <button
                    onClick={() => setActiveSubTab("tenants")}
                    className="btn btn-ghost"
                    style={{ 
                        color: activeSubTab === "tenants" ? "var(--primary)" : "inherit",
                        borderBottom: activeSubTab === "tenants" ? "2px solid var(--primary)" : "none",
                        borderRadius: 0
                    }}
                >
                    <Building size={18} style={{ marginRight: 8 }} /> Empresas ({tenants.length})
                </button>
                <button
                    onClick={() => setActiveSubTab("users")}
                    className="btn btn-ghost"
                    style={{ 
                        color: activeSubTab === "users" ? "var(--primary)" : "inherit",
                        borderBottom: activeSubTab === "users" ? "2px solid var(--primary)" : "none",
                        borderRadius: 0
                    }}
                >
                    <Users size={18} style={{ marginRight: 8 }} /> Usuários ({users.length})
                </button>
            </div>

            {loading ? (
                <div>Carregando...</div>
            ) : (
                <div className="card" style={{ background: "var(--card-bg)", borderRadius: 15, border: "1px solid var(--border)", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--border)" }}>
                                <th style={{ padding: "15px 20px", textAlign: "left" }}>Nome / Email</th>
                                {activeSubTab === "users" && <th style={{ padding: "15px 20px", textAlign: "left" }}>Empresa</th>}
                                <th style={{ padding: "15px 20px", textAlign: "left" }}>Excluído em</th>
                                <th style={{ padding: "15px 20px", textAlign: "right" }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeSubTab === "tenants" ? (
                                tenants.length === 0 ? (
                                    <tr><td colSpan={3} style={{ padding: 40, textAlign: "center", color: "#999" }}>Nenhuma empresa na lixeira</td></tr>
                                ) : (
                                    tenants.map(t => (
                                        <tr key={t.TenantId} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "15px 20px" }}>
                                                <div className="font-bold">{t.Name}</div>
                                                <div className="text-xs text-gray-500">{t.TenantId}</div>
                                            </td>
                                            <td style={{ padding: "15px 20px" }}>{new Date(t.DeletedAt).toLocaleString()}</td>
                                            <td style={{ padding: "15px 20px", textAlign: "right" }}>
                                                <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                                    <button onClick={() => handleRestore("tenants", t.TenantId)} className="btn btn-ghost text-primary" title="Restaurar"><RotateCcw size={18} /></button>
                                                    <button onClick={() => handlePermanentDelete("tenants", t.TenantId)} className="btn btn-ghost text-danger" title="Excluir Definitivamente"><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                users.length === 0 ? (
                                    <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#999" }}>Nenhum usuário na lixeira</td></tr>
                                ) : (
                                    users.map(u => (
                                        <tr key={u.UserId} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "15px 20px" }}>
                                                <div className="font-bold">{u.AgentName || 'Usuário'}</div>
                                                <div className="text-xs text-gray-500">{u.Email}</div>
                                            </td>
                                            <td style={{ padding: "15px 20px" }}>{u.TenantName}</td>
                                            <td style={{ padding: "15px 20px" }}>{new Date(u.DeletedAt).toLocaleString()}</td>
                                            <td style={{ padding: "15px 20px", textAlign: "right" }}>
                                                <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                                    <button onClick={() => handleRestore("users", u.UserId)} className="btn btn-ghost text-primary" title="Restaurar"><RotateCcw size={18} /></button>
                                                    <button onClick={() => handlePermanentDelete("users", u.UserId)} className="btn btn-ghost text-danger" title="Excluir Definitivamente"><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
