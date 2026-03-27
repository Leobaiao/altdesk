import React, { useState, useEffect } from "react";
import { Edit2, Play, Pause, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { UserModal } from "./Modals/UserModal";

type RoleFilter = "ALL" | "SUPERADMIN" | "ADMIN" | "AGENT";

export function UsersTab() {
    const [users, setUsers] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState<any>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");

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
            setUsers(Array.isArray(rUsers.data) ? rUsers.data : []);
            setTenants(Array.isArray(rTenants.data) ? rTenants.data : []);
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

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("Deseja mover este usuário para a LIXEIRA? Ele será desativado e poderá ser restaurado depois.")) return;
        try {
            await api.delete(`/api/admin/users/${userId}`);
            loadData();
        } catch (err: any) {
            alert(err.response?.data?.error || "Erro ao mover para a lixeira");
        }
    };


    const roleBadge = (role: string) => {
        const map: Record<string, { bg: string; color: string; label: string }> = {
            SUPERADMIN: { bg: "rgba(168,0,168,0.15)", color: "#d942f5", label: "SuperAdmin" },
            ADMIN: { bg: "rgba(255,152,0,0.15)", color: "#ff9800", label: "Admin" },
            AGENT: { bg: "rgba(0,168,132,0.15)", color: "#00a884", label: "Agente" },
        };
        return map[role] || { bg: "rgba(255,255,255,0.08)", color: "#aaa", label: role };
    };

    const roles: RoleFilter[] = ["ALL", "SUPERADMIN", "ADMIN", "AGENT"];

    const filteredUsers = users.filter(u => {
        const q = search.toLowerCase();
        const matchesSearch = !q || u.AgentName?.toLowerCase().includes(q) || u.Email?.toLowerCase().includes(q) || u.TenantName?.toLowerCase().includes(q);
        const matchesRole = roleFilter === "ALL" || u.Role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <>
            {/* Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, flexWrap: "wrap" }}>
                    <div style={{ position: "relative", maxWidth: 300, flex: 1 }}>
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", pointerEvents: "none" }}>🔍</span>
                        <input
                            placeholder="Buscar por nome, email ou empresa..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.9rem", outline: "none" }}
                            onFocus={e => (e.target.style.boxShadow = "0 0 0 2px var(--accent)")}
                            onBlur={e => (e.target.style.boxShadow = "none")}
                        />
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        {roles.map(r => (
                            <button
                                key={r}
                                onClick={() => setRoleFilter(r)}
                                style={{
                                    padding: "6px 12px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s", border: "none",
                                    background: roleFilter === r ? "var(--accent)" : "var(--bg-primary)",
                                    color: roleFilter === r ? "#fff" : "var(--text-secondary)"
                                }}
                            >
                                {r === "ALL" ? "Todos" : r === "SUPERADMIN" ? "SuperAdmin" : r === "ADMIN" ? "Admin" : "Agente"}
                            </button>
                        ))}
                    </div>
                    {!loading && (
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                            <b style={{ color: "var(--text-primary)" }}>{filteredUsers.length}</b> usuários
                        </span>
                    )}
                </div>
                <button onClick={() => { setEditUser(null); setShowModal(true); }} className="btn btn-primary" style={{ borderRadius: 10 }}>
                    + Novo Usuário
                </button>
            </div>

            {/* Table */}
            <div className="admin-table-container" style={{ overflowX: "auto", background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-primary)" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-active)", textAlign: "left" }}>
                            {["Nome", "Email", "Permissão", "Empresa", "Status", "Ações"].map((h, idx) => (
                                <th key={h} style={{ padding: "14px 20px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-secondary)", fontWeight: 700, textAlign: idx === 5 ? "right" : "left" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>
                                {loading ? "⏳ Carregando..." : "Nenhum usuário encontrado."}
                            </td></tr>
                        ) : filteredUsers.map(u => {
                            const rb = roleBadge(u.Role);
                            return (
                                <tr key={u.UserId} style={{ borderBottom: "1px solid var(--border)", opacity: u.IsActive ? 1 : 0.55, transition: "all 0.15s" }} className="table-row-hover">
                                    <td style={{ padding: "14px 20px" }}>
                                        <div style={{ fontWeight: 600 }}>{u.AgentName || u.Name || "—"}</div>
                                    </td>
                                    <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "0.9rem" }}>{u.Email}</td>
                                    <td style={{ padding: "14px 20px" }}>
                                        <span style={{ background: rb.bg, color: rb.color, padding: "3px 10px", borderRadius: 20, fontSize: "0.73rem", fontWeight: 700 }}>{rb.label}</span>
                                    </td>
                                    <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{u.TenantName || "—"}</td>
                                    <td style={{ padding: "14px 20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.85rem", fontWeight: 600, color: u.IsActive ? "var(--accent)" : "var(--danger)" }}>
                                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />
                                            {u.IsActive ? "Ativo" : "Inativo"}
                                        </div>
                                    </td>
                                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                            <button onClick={() => { setEditUser(u); setShowModal(true); }} className="btn btn-ghost" style={{ padding: 8, borderRadius: 8, height: "auto" }} title="Editar">
                                                <Edit2 size={15} />
                                            </button>
                                            <button
                                                onClick={() => handleToggleUserStatus(u.UserId, u.IsActive)}
                                                className="btn btn-ghost"
                                                style={{ padding: 8, borderRadius: 8, height: "auto", color: u.IsActive ? "var(--danger)" : "var(--accent)" }}
                                                title={u.IsActive ? "Desativar" : "Ativar"}
                                            >
                                                {u.IsActive ? <Pause size={15} /> : <Play size={15} />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(u.UserId)}
                                                className="btn btn-ghost"
                                                style={{ padding: 8, borderRadius: 8, height: "auto", color: "var(--danger)" }}
                                                title="Mover para Lixeira"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
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
