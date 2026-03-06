import React, { useState, useEffect } from "react";
import { Users as UsersIcon, Edit2, Play, Pause } from "lucide-react";
import { api } from "../../lib/api";
import { UserModal } from "./Modals/UserModal";

export function UsersTab() {
    const [users, setUsers] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rUsers, rTenants] = await Promise.all([
                api.get("/api/admin/users"),
                api.get("/api/admin/tenants")
            ]);

            if (Array.isArray(rUsers.data)) {
                setUsers(rUsers.data);
            } else {
                console.error("API returned non-array for users (tab):", rUsers.data);
                setUsers([]);
            }

            if (Array.isArray(rTenants.data)) {
                setTenants(rTenants.data);
            } else {
                console.error("API returned non-array for tenants (users tab):", rTenants.data);
                setTenants([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async (data: any) => {
        try {
            if (editUser) {
                await api.put(`/api/admin/users/${editUser.UserId}`, data);
            } else {
                await api.post("/api/admin/users", data);
            }
            loadData();
        } catch (err: any) {
            alert(err.response?.data?.error || "Erro ao salvar usuário");
        }
    };

    const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
        try {
            await api.put(`/api/admin/users/${userId}/status`, { isActive: !currentStatus });
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const openEditUser = (u: any) => {
        setEditUser(u);
        setShowModal(true);
    };

    const openNewUser = () => {
        setEditUser(null);
        setShowModal(true);
    };

    return (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}>
                    <UsersIcon size={18} />
                    {loading ? <span>Carregando...</span> : <span>{users.length} usuários encontrados</span>}
                </div>
                <button onClick={openNewUser} className="btn btn-primary" style={{ borderRadius: 10 }}>
                    + Novo Usuário
                </button>
            </div>
            <div style={{ overflowX: "auto", background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-primary)" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-active)", textAlign: "left" }}>
                            <th style={{ padding: "16px 20px" }}>Nome</th>
                            <th style={{ padding: "16px 20px" }}>Email</th>
                            <th style={{ padding: "16px 20px" }}>Permissão</th>
                            <th style={{ padding: "16px 20px" }}>Empresa</th>
                            <th style={{ padding: "16px 20px" }}>Status</th>
                            <th style={{ padding: "16px 20px", textAlign: "right" }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.UserId} style={{ borderBottom: "1px solid var(--border)", opacity: u.IsActive ? 1 : 0.6, transition: "background 0.2s" }} className="table-row-hover">
                                <td style={{ padding: "16px 20px", fontWeight: 500 }}>{u.AgentName || u.Name || "-"}</td>
                                <td style={{ padding: "16px 20px", color: "var(--text-secondary)" }}>{u.Email}</td>
                                <td style={{ padding: "16px 20px" }}>
                                    <span style={{
                                        padding: "4px 10px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700,
                                        background: u.Role === "SUPERADMIN" ? "rgba(168, 0, 132, 0.15)" : (u.Role === "ADMIN" ? "rgba(255, 152, 0, 0.15)" : "rgba(0, 168, 132, 0.15)"),
                                        color: u.Role === "SUPERADMIN" ? "#d942f5" : (u.Role === "ADMIN" ? "#ff9800" : "#00a884")
                                    }}>
                                        {u.Role}
                                    </span>
                                </td>
                                <td style={{ padding: "16px 20px" }}>{u.TenantName || "Sem Tenant"}</td>
                                <td style={{ padding: "16px 20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600, color: u.IsActive ? "var(--accent)" : "var(--danger)" }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }} />
                                        {u.IsActive ? "Ativo" : "Inativo"}
                                    </div>
                                </td>
                                <td style={{ padding: "16px 20px", textAlign: "right" }}>
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                        <button
                                            onClick={() => openEditUser(u)}
                                            className="btn btn-ghost"
                                            style={{ padding: 8, borderRadius: 8 }}
                                            title="Editar Usuário"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleUserStatus(u.UserId, u.IsActive)}
                                            className="btn btn-ghost"
                                            style={{ padding: 8, borderRadius: 8, color: u.IsActive ? "var(--danger)" : "var(--accent)" }}
                                            title={u.IsActive ? "Desativar" : "Ativar"}
                                        >
                                            {u.IsActive ? <Pause size={16} /> : <Play size={16} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <UserModal
                    editUser={editUser}
                    tenants={tenants}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleSaveUser}
                />
            )}
        </>
    );
}
