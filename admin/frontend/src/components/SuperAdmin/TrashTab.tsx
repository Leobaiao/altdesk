import React, { useState, useEffect } from "react";
import { Trash2, RotateCcw, Building, Users } from "lucide-react";
import { api } from "../../lib/api";

export function TrashTab() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<"tenants" | "users">("tenants");
    const [confirmDelete, setConfirmDelete] = useState<{
        type: "tenants" | "users", 
        id: string, 
        name: string,
        extraInfo?: React.ReactNode
    } | null>(null);
    const [deleteInput, setDeleteInput] = useState("");

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
        try {
            await api.delete(`/api/admin/${type}/${id}/permanent`);
            setConfirmDelete(null);
            setDeleteInput("");
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
                    <p className="text-sm text-gray-500">Recupere ou apague definitivamente itens excluídos.</p>
                </div>
            </div>

            <div style={{ padding: "12px 16px", background: "rgba(255, 152, 0, 0.1)", borderLeft: "4px solid #ff9800", borderRadius: "0 8px 8px 0", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <Trash2 size={20} color="#ff9800" />
                <span style={{ fontSize: "0.9rem", color: "#e68a00", fontWeight: 500 }}>
                    <strong>Limpeza Automática:</strong> Itens na lixeira são apagados definitivamente após 30 dias.
                </span>
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
                                                    <button onClick={() => setConfirmDelete({ 
                                                        type: "tenants", 
                                                        id: t.TenantId, 
                                                        name: t.Name,
                                                        extraInfo: (
                                                            <div style={{ marginTop: 10, background: "rgba(0,0,0,0.03)", padding: 12, borderRadius: 8, fontSize: "0.85rem", border: "1px solid var(--border)" }}>
                                                                <div><strong>ID da Empresa:</strong> {t.TenantId}</div>
                                                                <div><strong>Enviado para a lixeira em:</strong> {new Date(t.DeletedAt).toLocaleString()}</div>
                                                            </div>
                                                        )
                                                    })} className="btn btn-ghost text-danger" title="Excluir Definitivamente"><Trash2 size={18} /></button>
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
                                                    <button onClick={() => setConfirmDelete({ 
                                                        type: "users", 
                                                        id: u.UserId, 
                                                        name: u.AgentName || 'Usuário',
                                                        extraInfo: (
                                                            <div style={{ marginTop: 10, background: "rgba(0,0,0,0.03)", padding: 12, borderRadius: 8, fontSize: "0.85rem", border: "1px solid var(--border)" }}>
                                                                <div><strong>Email:</strong> {u.Email}</div>
                                                                <div><strong>Empresa:</strong> {u.TenantName}</div>
                                                                <div><strong>Enviado para a lixeira em:</strong> {new Date(u.DeletedAt).toLocaleString()}</div>
                                                            </div>
                                                        )
                                                    })} className="btn btn-ghost text-danger" title="Excluir Definitivamente"><Trash2 size={18} /></button>
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

            {/* Modal de Confirmação de Exclusão Definitiva */}
            {confirmDelete && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="card" style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 15, width: "100%", maxWidth: 400, border: "1px solid var(--border)", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                        <h3 style={{ marginTop: 0, color: "var(--danger)", display: "flex", alignItems: "center", gap: 10 }}>
                            <Trash2 size={24} /> Exclusão Definitiva
                        </h3>
                        <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            Atenção: Você está prestes a excluir permanentemente <strong>{confirmDelete.name}</strong> e todos os dados associados a ele no banco de dados. 
                            <strong> Esta ação não pode ser desfeita.</strong>
                        </p>
                        
                        {confirmDelete.extraInfo}

                        <p style={{ fontSize: "0.9rem", color: "var(--text-primary)", marginTop: 20, marginBottom: 15 }}>
                            Para confirmar, digite <strong>EXCLUIR</strong> abaixo:
                        </p>
                        <input 
                            type="text" 
                            className="input" 
                            style={{ width: "100%", marginBottom: 24, padding: "10px 14px" }}
                            value={deleteInput}
                            onChange={(e) => setDeleteInput(e.target.value)}
                            placeholder="EXCLUIR"
                            autoFocus
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => { setConfirmDelete(null); setDeleteInput(""); }}
                            >
                                Cancelar
                            </button>
                            <button 
                                className="btn btn-danger" 
                                onClick={() => handlePermanentDelete(confirmDelete.type, confirmDelete.id)}
                                disabled={deleteInput !== "EXCLUIR"}
                                style={{ opacity: deleteInput !== "EXCLUIR" ? 0.5 : 1 }}
                            >
                                Excluir Permanentemente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
