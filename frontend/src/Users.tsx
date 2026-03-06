import React, { useEffect, useState } from "react";
import {
    Users as UsersIcon,
    Edit2,
    Trash2,
    Mail,
    MessageSquare,
    Shield,
    User as UserIcon,
    ArrowLeft,
    Pause,
    Play
} from "lucide-react";

import { api } from "./lib/api";
import type { User } from "../../shared/types";

interface Props {
    token: string;
    onBack: () => void;
    role: string;
}

export function Users({ token, onBack, role }: Props) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

    // Form states
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [userRole, setUserRole] = useState("AGENT");
    const [msg, setMsg] = useState("");

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        setLoading(true);
        try {
            const res = await api.get<User[]>("/api/users");
            if (Array.isArray(res.data)) {
                setUsers(res.data);
            } else {
                console.error("API returned non-array for users:", res.data);
                setUsers([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg("");
        try {
            const method = editingUser ? "put" : "post";
            const url = editingUser ? `/api/users/${editingUser.UserId}` : `/api/users`;

            const payload: any = { name, email, role: userRole };
            if (password || !editingUser) {
                payload.password = password;
            }

            await api[method](url, payload);

            setMsg(editingUser ? "✅ Usuário atualizado!" : "✅ Usuário criado!");
            setTimeout(() => setMsg(""), 3000);
            closeModal();
            loadUsers();
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message;
            setMsg("❌ " + errorMsg);
        }
    }

    async function handleToggleStatus(userId: string, currentStatus: boolean) {
        if (!confirm(`Tem certeza que deseja ${currentStatus ? 'desativar' : 'ativar'} este usuário?`)) return;
        try {
            await api.put(`/api/users/${userId}/status`, { isActive: !currentStatus });
            loadUsers();
        } catch (e) {
            console.error(e);
            alert("Erro ao alterar status do usuário.");
        }
    }

    function openEdit(u: User) {
        setEditingUser(u);
        setName(u.AgentName || u.Name || "");
        setEmail(u.Email);
        setUserRole(u.Role);
        setPassword("");
        setShowModal(true);
    }

    function openCreate() {
        setEditingUser(null);
        setName("");
        setEmail("");
        setUserRole("AGENT");
        setPassword("");
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingUser(null);
    }

    return (
        <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto", height: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <button
                        onClick={onBack}
                        className="btn btn-ghost"
                        style={{ padding: 8, borderRadius: "50%" }}
                        title="Voltar"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <UsersIcon size={24} className="text-accent" />
                            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Minha Equipe</h1>
                        </div>
                        <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                            {isAdmin ? "Gerencie os membros da sua empresa e suas permissões." : "Conheça seus colegas de equipe."}
                        </p>
                    </div>
                </div>

                {isAdmin && (
                    <button className="btn btn-primary" onClick={openCreate} style={{ borderRadius: 12, padding: "10px 20px" }}>
                        + Novo Membro
                    </button>
                )}
            </div>

            {msg && (
                <div style={{
                    padding: "12px 20px",
                    background: msg.includes("❌") ? "rgba(234, 67, 53, 0.1)" : "rgba(0, 168, 132, 0.1)",
                    color: msg.includes("❌") ? "var(--danger)" : "var(--accent)",
                    marginBottom: 24,
                    borderRadius: 12,
                    border: "1px solid currentColor",
                    fontWeight: 600
                }}>
                    {msg}
                </div>
            )}

            <div style={{
                background: "var(--bg-secondary)",
                borderRadius: 20,
                border: "1px solid var(--border)",
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
            }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
                            <th style={{ padding: "20px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)" }}>Membro</th>
                            <th style={{ padding: "20px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)" }}>Email</th>
                            <th style={{ padding: "20px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)" }}>Função</th>
                            <th style={{ padding: "20px", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)" }}>Status</th>
                            <th style={{ padding: "20px", textAlign: "right", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)" }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={5} style={{ padding: 40, textAlign: "center" }}>
                                    <div className="spinner" style={{ margin: "0 auto" }}></div>
                                    <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>Carregando equipe...</p>
                                </td>
                            </tr>
                        )}
                        {!loading && users.map(u => (
                            <tr key={u.UserId} className="table-row-hover" style={{ borderBottom: "1px solid var(--border)", transition: "all 0.2s" }}>
                                <td style={{ padding: "16px 20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 12,
                                            background: "var(--bg-primary)",
                                            display: "flex", alignItems: "center", justifyContent: "center"
                                        }}>
                                            <UserIcon size={20} className="text-secondary" />
                                        </div>
                                        <div style={{ fontWeight: 600, fontSize: "1rem" }}>{u.AgentName || u.Name || "Sem Nome"}</div>
                                    </div>
                                </td>
                                <td style={{ padding: "16px 20px", color: "var(--text-secondary)" }}>{u.Email}</td>
                                <td style={{ padding: "16px 20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {u.Role === "ADMIN" ? <Shield size={14} className="text-secondary" /> : null}
                                        <span style={{
                                            padding: "4px 10px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700,
                                            background: u.Role === "ADMIN" ? "rgba(217, 66, 245, 0.15)" : "rgba(0, 168, 132, 0.15)",
                                            color: u.Role === "ADMIN" ? "#d942f5" : "#00a884"
                                        }}>
                                            {u.Role}
                                        </span>
                                    </div>
                                </td>
                                <td style={{ padding: "16px 20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: u.IsActive ? "var(--accent)" : "var(--danger)", fontSize: "0.85rem", fontWeight: 600 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }} />
                                        {u.IsActive ? "Ativo" : "Inativo"}
                                    </div>
                                </td>
                                <td style={{ padding: "16px 20px", textAlign: "right" }}>
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                        <button
                                            onClick={() => window.location.href = `mailto:${u.Email}`}
                                            className="btn btn-ghost"
                                            style={{ padding: 8, borderRadius: 8 }}
                                            title="Enviar Email"
                                        >
                                            <Mail size={18} />
                                        </button>

                                        {isAdmin && (
                                            <>
                                                <button
                                                    onClick={() => openEdit(u)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: 8, borderRadius: 8 }}
                                                    title="Editar"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(u.UserId, u.IsActive ?? true)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: 8, borderRadius: 8, color: u.IsActive ? "var(--danger)" : "var(--accent)" }}
                                                    title={u.IsActive ? "Desativar" : "Ativar"}
                                                >
                                                    {u.IsActive ? <Pause size={18} /> : <Play size={18} />}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de Gerenciamento (Backdrop Blur Standard) */}
            {showModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.6)",
                    backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        width: "100%", maxWidth: 450,
                        padding: 32,
                        borderRadius: 20,
                        boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                            <UserIcon size={24} className="text-accent" />
                            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                                {editingUser ? "Editar Membro" : "Novo Membro da Equipe"}
                            </h2>
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 28 }}>
                            Defina o acesso e as permissões para este usuário.
                        </p>

                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <div className="field">
                                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Nome Completo</label>
                                <input
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: João Silva"
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                />
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Email de Acesso</label>
                                <input
                                    required
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="joao@empresa.com"
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                />
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Senha</label>
                                <input
                                    required={!editingUser}
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder={editingUser ? "Deixe vazio para manter" : "••••••"}
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                />
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Permissão</label>
                                <select
                                    value={userRole}
                                    onChange={e => setUserRole(e.target.value)}
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer" }}
                                >
                                    <option value="AGENT">Agente (Atendimento)</option>
                                    <option value="ADMIN">Administrador (Gestão)</option>
                                </select>
                            </div>

                            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                                <button type="button" onClick={closeModal} className="btn" style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 12 }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "12px", borderRadius: 12 }}>
                                    {editingUser ? "Salvar Alterações" : "Criar Usuário"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
