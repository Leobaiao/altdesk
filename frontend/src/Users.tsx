import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
    Play,
    MonitorSmartphone,
    Image as ImageIcon,
    Lock,
    Briefcase,
    KeySquare,
    ShieldCheck,
    Upload
} from "lucide-react";

import { api } from "./lib/api";
import { useChat } from "./contexts/ChatContext";
import { PageHeader } from "./components/PageHeader";
import type { User } from "../../shared/types";

interface Props {
    token: string;
    onBack: () => void;
    role: string;
    livePermissions?: any;
}

export function Users({ token, onBack, role, livePermissions }: Props) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
    const canManageUsers = isAdmin || livePermissions?.users !== false;

    // Profile States
    const [profileName, setProfileName] = useState("");
    const [profilePassword, setProfilePassword] = useState("");
    const [profileAvatar, setProfileAvatar] = useState("");
    const [profilePosition, setProfilePosition] = useState("");
    const [profileDefaultPage, setProfileDefaultPage] = useState("");
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
    const [savingProfile, setSavingProfile] = useState(false);

    // Profile photo preview states
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

    // Form states
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const { showToast, showConfirm, setSelectedConversationId, refreshConversations } = useChat();
    const navigate = useNavigate();
    const location = useLocation();
    const [password, setPassword] = useState("");
    const [userRole, setUserRole] = useState("AGENT");
    const [position, setPosition] = useState("");
    const [defaultPage, setDefaultPage] = useState("");
    const [permissions, setPermissions] = useState({
        dashboard: true,
        chat: true,
        tickets: true,
        contacts: true,
        reports: true,
        billing: false,
        users: false,
        settings: true
    });
    const [msg, setMsg] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const defaultTab = location.state?.tab || (canManageUsers ? "TECH" : "PROFILE");
    const [activeTab, setActiveTab] = useState<"PROFILE" | "TECH" | "COLLAB">(defaultTab);

    useEffect(() => {
        if (canManageUsers) {
            loadUsers();
        }
        loadProfile();
    }, [canManageUsers]);

    const isSafeUrl = (url: string) => {
        if (!url) return false;
        return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/") || url.startsWith("/");
    };

    function toggleTheme(newTheme: string) {
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
        if (newTheme === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
    }

    async function loadProfile() {
        try {
            const res = await api.get("/api/profile");
            if (res.data) {
                setProfileName(res.data.Name || "");
                setProfileAvatar(res.data.Avatar || "");
                setProfilePosition(res.data.Position || "");
                setProfileDefaultPage(res.data.DefaultPage || "");
            }
        } catch (err) {
            console.error("Erro ao carregar perfil:", err);
        }
    }

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        setMsg("");
        try {
            let finalAvatar = profileAvatar;

            if (avatarFile) {
                const formData = new FormData();
                formData.append("file", avatarFile);
                
                const res = await api.post("/api/upload/avatar", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                
                if (res.data && res.data.url) {
                    finalAvatar = res.data.url;
                    setProfileAvatar(finalAvatar);
                }
            }

            await api.put("/api/profile", {
                name: profileName || undefined,
                password: profilePassword || undefined,
                avatar: finalAvatar || undefined,
                position: profilePosition || undefined,
                defaultPage: profileDefaultPage || undefined
            });
            if (profileDefaultPage) {
                localStorage.setItem("defaultPage", profileDefaultPage);
            } else {
                localStorage.removeItem("defaultPage");
            }

            // Clean up preview states
            setAvatarFile(null);
            if (avatarPreviewUrl) {
                URL.revokeObjectURL(avatarPreviewUrl);
                setAvatarPreviewUrl(null);
            }

            setMsg("✅ Perfil atualizado com sucesso! Recarregando...");
            setProfilePassword("");
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message;
            setMsg("❌ Erro no Perfil: " + errorMsg);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        setAvatarFile(file);
        
        if (avatarPreviewUrl) {
            URL.revokeObjectURL(avatarPreviewUrl);
        }
        setAvatarPreviewUrl(URL.createObjectURL(file));
        showToast("Avatar selecionado! Clique em 'Salvar Perfil' para confirmar.", "success");
    };

    useEffect(() => {
        return () => {
            if (avatarPreviewUrl) {
                URL.revokeObjectURL(avatarPreviewUrl);
            }
        };
    }, [avatarPreviewUrl]);

    const techUsers = users.filter(u => (u.Role === "ADMIN" || u.Role === "SUPERADMIN" || u.Role === "AGENT") && 
        (u.Name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.Email.toLowerCase().includes(searchTerm.toLowerCase())));
    const collabUsers = users.filter(u => u.Role === "END_USER" && 
        (u.Name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.Email.toLowerCase().includes(searchTerm.toLowerCase())));
    const displayedUsers = activeTab === "TECH" ? techUsers : collabUsers;

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

            const payload: any = { 
                name, 
                email, 
                role: userRole, 
                position,
                defaultPage: defaultPage || undefined,
                permissions 
            };
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

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        showConfirm({
            title: currentStatus ? "Desativar Usuário" : "Ativar Usuário",
            description: `Tem certeza que deseja ${currentStatus ? 'desativar' : 'ativar'} este usuário?`,
            onConfirm: async () => {
                try {
                    await api.post(`/api/users/${id}/status`, { isActive: !currentStatus });
                    loadUsers();
                    showToast("Status atualizado!", "success");
                } catch (err) {
                    showToast("Erro ao atualizar status", "error");
                }
            }
        });
    };

    const handleDelete = async (id: string) => {
        showConfirm({
            title: "Mover para Lixeira",
            description: "Deseja mover este usuário para a LIXEIRA? Ele será desativado e poderá ser restaurado pelo administrador do sistema.",
            confirmLabel: "Mover para Lixeira",
            isDanger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/api/users/${id}`);
                    loadUsers();
                    showToast("Usuário movido para a lixeira", "success");
                } catch (err) {
                    showToast("Erro ao excluir usuário", "error");
                }
            }
        });
    };

    const handleStartChat = async (u: User) => {
        try {
            const res = await api.post("/api/conversations", {
                userId: u.UserId,
                name: u.AgentName || u.Name
            });
            if (res.data.conversationId) {
                setSelectedConversationId(res.data.conversationId);
                refreshConversations();
                navigate("/chat");
            }
        } catch (err: any) {
            showToast("Erro ao iniciar conversa: " + (err.response?.data?.error || err.message), "error");
        }
    };


    function openEdit(u: User) {
        setEditingUser(u);
        setName(u.AgentName || u.Name || "");
        setEmail(u.Email);
        setUserRole(u.Role);
        setPosition(u.Position || "");
        setDefaultPage(u.DefaultPage || "");
        setPassword("");
        
        if (u.PermissionsJson) {
            try {
                setPermissions(JSON.parse(u.PermissionsJson));
            } catch (e) {
                console.error("error parsing permissions", e);
            }
        } else {
            setPermissions({
                dashboard: true, chat: true, tickets: true, contacts: true, 
                reports: true, billing: u.Role === 'ADMIN', users: u.Role === 'ADMIN', settings: true
            });
        }
        setShowModal(true);
    }

    function openCreate() {
        setEditingUser(null);
        setName("");
        setEmail("");
        setUserRole("AGENT");
        setPosition("");
        setDefaultPage("");
        setPermissions({
            dashboard: true, chat: true, tickets: true, contacts: true, 
            reports: true, billing: false, users: false, settings: true
        });
        setPassword("");
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingUser(null);
    }

    return (
        <div className="settings-page" style={{ height: "100%", overflowY: "auto" }}>
            <PageHeader
                title={activeTab === "PROFILE" ? "Meu Perfil" : activeTab === "TECH" ? "Agentes" : "Usuários"}
                subtitle={activeTab === "PROFILE" ? "Gerencie suas informações pessoais e aparência." : (isAdmin ? "Gerencie os membros da sua empresa e suas permissões." : "Conheça seus colegas de equipe.")}
                icon={activeTab === "PROFILE" ? UserIcon : UsersIcon}
                onBack={onBack}
                contextKey="users.index"
                helpText={
                    <div>
                        {activeTab === "PROFILE" ? (
                            <p>Atualize seu nome, cargo, avatar e senha, além de alternar entre o tema Claro e Escuro.</p>
                        ) : (
                            <>
                                <p>Gerencie quem tem acesso à plataforma e quais níveis de permissão cada membro possui.</p>
                                <ul style={{ marginTop: 12, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                                    <li><strong>Administradores:</strong> Têm acesso total às configurações, faturamento e gestão de usuários.</li>
                                    <li><strong>Operadores:</strong> Focados no atendimento ao cliente e gestão de tickets.</li>
                                    <li><strong>Status:</strong> Ative ou desative membros conforme a necessidade da sua equipe.</li>
                                    <li><strong>Segurança:</strong> Apenas administradores podem convidar novos membros para a empresa.</li>
                                </ul>
                            </>
                        )}
                    </div>
                }
                actionNode={
                    isAdmin && activeTab !== "PROFILE" ? (
                        <button className="btn btn-primary" onClick={openCreate} style={{ borderRadius: 12, padding: "10px 20px" }}>
                            + Novo Membro
                        </button>
                    ) : undefined
                }
            />

            {msg && (
                <div style={{
                    padding: "12px 20px",
                    background: msg.includes("❌") ? "rgba(234, 67, 53, 0.1)" : "rgba(0, 168, 132, 0.1)",
                    color: msg.includes("❌") ? "var(--danger)" : "var(--accent)",
                    marginBottom: 24,
                    borderRadius: 12,
                    border: "1px solid currentColor",
                    fontWeight: 600,
                    zIndex: 1001, // Corrigindo z-index para visibilidade
                    position: "relative"
                }}>
                    {msg}
                </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, marginBottom: 20, padding: "0 20px" }}>
                <div style={{ display: "flex", gap: 20 }}>
                    <button 
                        onClick={() => setActiveTab("PROFILE")}
                        style={{ 
                            background: "none", border: "none", borderBottom: activeTab === "PROFILE" ? "3px solid var(--accent)" : "3px solid transparent",
                            padding: "10px 15px", cursor: "pointer", fontWeight: 700, fontSize: "0.95rem",
                            color: activeTab === "PROFILE" ? "var(--accent)" : "var(--text-secondary)", transition: "all 0.2s"
                        }}
                    >
                        Meu Perfil
                    </button>
                    {canManageUsers && (
                        <>
                            <button 
                                onClick={() => setActiveTab("TECH")}
                                style={{ 
                                    background: "none", border: "none", borderBottom: activeTab === "TECH" ? "3px solid var(--accent)" : "3px solid transparent",
                                    padding: "10px 15px", cursor: "pointer", fontWeight: 700, fontSize: "0.95rem",
                                    color: activeTab === "TECH" ? "var(--accent)" : "var(--text-secondary)", transition: "all 0.2s"
                                }}
                            >
                                Time Técnico ({techUsers.length})
                            </button>
                            <button 
                                onClick={() => setActiveTab("COLLAB")}
                                style={{ 
                                    background: "none", border: "none", borderBottom: activeTab === "COLLAB" ? "3px solid var(--accent)" : "3px solid transparent",
                                    padding: "10px 15px", cursor: "pointer", fontWeight: 700, fontSize: "0.95rem",
                                    color: activeTab === "COLLAB" ? "var(--accent)" : "var(--text-secondary)", transition: "all 0.2s"
                                }}
                            >
                                Usuários ({collabUsers.length})
                            </button>
                        </>
                    )}
                </div>

                {activeTab !== "PROFILE" && (
                    <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
                        <input 
                            type="text" 
                            placeholder="Buscar por nome ou email..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ 
                                width: "100%", padding: "10px 15px", borderRadius: 12, border: "1px solid var(--border)", 
                                background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.85rem" 
                            }}
                        />
                    </div>
                )}
            </div>


            {activeTab !== "PROFILE" ? (
                <div style={{
                    background: "var(--bg-secondary)",
                    borderRadius: 20,
                    border: "1px solid var(--border)",
                    overflowX: "auto",
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
                            {!loading && displayedUsers.map(u => (
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
                                                {u.Role === 'END_USER' ? 'USUÁRIO' : u.Role === 'AGENT' ? 'AGENTE' : u.Role}
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
                                            <a
                                                href={`mailto:${/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(u.Email) ? u.Email : ""}`}
                                                className="btn btn-ghost"
                                                style={{ padding: 8, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                                title="Enviar Email"
                                            >
                                                <Mail size={18} />
                                            </a>

                                            <button
                                                onClick={() => handleStartChat(u)}
                                                className="btn btn-ghost"
                                                style={{ padding: 8, borderRadius: 8, color: "var(--accent)" }}
                                                title="Iniciar Conversa"
                                            >
                                                <MessageSquare size={18} />
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
                                                    <button
                                                        onClick={() => handleDelete(u.UserId)}
                                                        className="btn btn-ghost"
                                                        style={{ padding: 8, borderRadius: 8, color: "var(--danger)" }}
                                                        title="Mover para Lixeira"
                                                    >
                                                        <Trash2 size={18} />
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
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "0 20px" }}>
                    <div style={{ maxWidth: 800 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                            {/* Tema e Aparência */}
                            <div style={{ 
                                padding: 24, 
                                background: "var(--bg-secondary)", 
                                border: "1px solid var(--border)", 
                                borderRadius: 20 
                            }}>
                                <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
                                    <MonitorSmartphone size={20} className="text-accent" /> Aparência e Tema
                                </h3>
                                <div style={{ display: "flex", gap: 12 }}>
                                    <button 
                                        onClick={() => toggleTheme("light")}
                                        style={{
                                            flex: 1, padding: 16, borderRadius: 12, border: "2px solid",
                                            borderColor: theme === "light" ? "var(--accent)" : "var(--border)",
                                            background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer",
                                            display: "flex", flexDirection: "column", alignItems: "center", gap: 8
                                        }}
                                    >
                                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f8f9fa", border: "1px solid #dee2e6" }} />
                                        <span style={{ fontWeight: 600 }}>Claro</span>
                                    </button>
                                    <button 
                                        onClick={() => toggleTheme("dark")}
                                        style={{
                                            flex: 1, padding: 16, borderRadius: 12, border: "2px solid",
                                            borderColor: theme === "dark" ? "var(--accent)" : "var(--border)",
                                            background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer",
                                            display: "flex", flexDirection: "column", alignItems: "center", gap: 8
                                        }}
                                    >
                                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1a1b1e", border: "1px solid #2c2e33" }} />
                                        <span style={{ fontWeight: 600 }}>Escuro</span>
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24, alignItems: "start" }}>
                                {/* Avatar Section */}
                                <div style={{ 
                                    padding: 24, 
                                    background: "var(--bg-secondary)", 
                                    border: "1px solid var(--border)", 
                                    borderRadius: 20,
                                    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"
                                }}>
                                    <div style={{
                                        width: 120, height: 120, borderRadius: "50%", 
                                        background: "var(--bg-primary)", border: "4px solid var(--accent)",
                                        marginBottom: 16, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                                        position: "relative"
                                    }}>
                                        {avatarPreviewUrl ? (
                                            <div style={{ width: "100%", height: "100%", position: "relative" }}>
                                                <img src={avatarPreviewUrl} alt="Avatar Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                <div style={{
                                                    position: "absolute", bottom: 0, left: 0, right: 0,
                                                    background: "rgba(0, 168, 132, 0.8)", color: "white",
                                                    fontSize: "0.7rem", fontWeight: "bold", padding: "2px 0",
                                                    textAlign: "center"
                                                }}>
                                                    Pré-visualização
                                                </div>
                                            </div>
                                        ) : isSafeUrl(profileAvatar) ? (
                                            <img src={profileAvatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        ) : (
                                            <UserIcon size={48} className="text-secondary" />
                                        )}
                                    </div>
                                    
                                    <div style={{ width: "100%", textAlign: "left", marginTop: 10 }}>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                            <ImageIcon size={14} /> Imagem de Perfil
                                        </label>
                                        
                                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                            <label className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)" }}>
                                                <Upload size={16} /> Enviar Imagem
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    onChange={handleAvatarUpload}
                                                    style={{ display: "none" }} 
                                                    disabled={savingProfile}
                                                />
                                            </label>
                                            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>ou digite a URL abaixo:</span>
                                        </div>

                                        {avatarFile && (
                                            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                                                <span>Selecionado: <strong>{avatarFile.name}</strong></span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAvatarFile(null);
                                                        if (avatarPreviewUrl) {
                                                            URL.revokeObjectURL(avatarPreviewUrl);
                                                            setAvatarPreviewUrl(null);
                                                        }
                                                    }}
                                                    style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontWeight: 600 }}
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        )}
                                        
                                        <input
                                            type="text"
                                            value={avatarFile ? `Arquivo local: ${avatarFile.name}` : profileAvatar}
                                            onChange={e => {
                                                setProfileAvatar(e.target.value);
                                                setAvatarFile(null);
                                                if (avatarPreviewUrl) {
                                                    URL.revokeObjectURL(avatarPreviewUrl);
                                                    setAvatarPreviewUrl(null);
                                                }
                                            }}
                                            placeholder="https://..."
                                            className="settings-input"
                                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s", marginTop: 12 }}
                                            disabled={!!avatarFile}
                                        />
                                    </div>
                                </div>

                                {/* Informações Pessoais Section */}
                                <div style={{ 
                                    padding: 24, 
                                    background: "var(--bg-secondary)", 
                                    border: "1px solid var(--border)", 
                                    borderRadius: 20,
                                    display: "flex", flexDirection: "column", gap: 20
                                }}>
                                    <div>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                            <KeySquare size={14} /> Nome de Exibição
                                        </label>
                                        <input
                                            type="text"
                                            value={profileName}
                                            onChange={e => setProfileName(e.target.value)}
                                            placeholder="Seu nome"
                                            className="settings-input"
                                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                            <Briefcase size={14} /> Cargo / Função (Opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={profilePosition}
                                            onChange={e => setProfilePosition(e.target.value)}
                                            placeholder="Ex: Atendente, Gerente..."
                                            className="settings-input"
                                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                            <MonitorSmartphone size={14} /> Tela Inicial Padrão
                                        </label>
                                        <select
                                            value={profileDefaultPage}
                                            onChange={e => setProfileDefaultPage(e.target.value)}
                                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }}
                                        >
                                            <option value="">Padrão do Sistema</option>
                                            <option value="/dashboard">Dashboard</option>
                                            <option value="/chat">Central de Mensagens (Chat)</option>
                                            <option value="/tickets">Meus Chamados (Tickets)</option>
                                            <option value="/contacts">Lista de Contatos</option>
                                            <option value="/reports">Relatórios Analíticos</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                            <Lock size={14} /> Nova Senha
                                        </label>
                                        <input
                                            type="password"
                                            value={profilePassword}
                                            onChange={e => setProfilePassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
                                            className="settings-input"
                                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }}
                                        />
                                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 6 }}>Deixe em branco para não alterar.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Save Action for Profile */}
                            <div style={{ 
                                padding: "20px 30px", 
                                background: "var(--bg-secondary)", 
                                border: "1px solid var(--border)", 
                                borderRadius: 16,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "15px"
                            }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Salvar Alterações</h4>
                                    <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                        Atualize suas informações pessoais e tema de preferência do sistema.
                                    </p>
                                </div>
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={savingProfile}
                                    className="btn btn-primary"
                                    style={{ padding: "14px 40px", borderRadius: 10, fontWeight: 600, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}
                                >
                                    <ShieldCheck size={18} />
                                    {savingProfile ? "Salvando..." : "Salvar Perfil"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                        maxHeight: "90vh",
                        overflowY: "auto",
                        padding: 24,
                        borderRadius: 20,
                        boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                            <UserIcon size={24} className="text-accent" />
                            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                                {editingUser ? "Editar Membro" : "Novo Membro da Equipe"}
                            </h2>
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 20 }}>
                            Defina o acesso e as permissões para este usuário.
                        </p>

                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Nomenclatura do Cargo</label>
                                <input
                                    value={position}
                                    onChange={e => setPosition(e.target.value)}
                                    placeholder="Ex: Supervisor de Atendimento"
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                />
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Permissão Base</label>
                                <select
                                    value={userRole}
                                    onChange={e => {
                                        const newRole = e.target.value;
                                        setUserRole(newRole);
                                        if (newRole === 'END_USER') {
                                            setPermissions({
                                                dashboard: false, chat: true, tickets: true, contacts: false, 
                                                reports: false, billing: false, users: false, settings: false
                                            });
                                        } else if (newRole === 'AGENT') {
                                            setPermissions(p => ({ ...p, billing: false, users: false }));
                                        } else if (newRole === 'ADMIN') {
                                            setPermissions({
                                                dashboard: true, chat: true, tickets: true, contacts: true, 
                                                reports: true, billing: true, users: true, settings: true
                                            });
                                        }
                                    }}
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer" }}
                                >
                                    <option value="ADMIN">Administrador/Supervisor (Acesso Total)</option>
                                    <option value="AGENT">Agente/Técnico (Atendimento)</option>
                                    <option value="END_USER">Colaborador (Não faz parte do corpo técnico)</option>
                                </select>
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Tela Inicial Padrão</label>
                                <select
                                    value={defaultPage}
                                    onChange={e => setDefaultPage(e.target.value)}
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer" }}
                                >
                                    <option value="">Padrão do Sistema</option>
                                    <option value="/dashboard">Dashboard</option>
                                    <option value="/chat">Central de Mensagens (Chat)</option>
                                    <option value="/tickets">Meus Chamados (Tickets)</option>
                                    <option value="/contacts">Lista de Contatos</option>
                                    <option value="/reports">Relatórios Analíticos</option>
                                </select>
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Áreas de Acesso</label>
                                <div style={{ 
                                    display: "grid", 
                                    gridTemplateColumns: "1fr 1fr", 
                                    gap: "10px", 
                                    marginTop: 12,
                                    padding: "15px",
                                    background: "rgba(255,255,255,0.02)",
                                    borderRadius: "12px",
                                    border: "1px solid var(--border)"
                                }}>
                                    {[
                                        { key: 'dashboard', label: 'Dashboard' },
                                        { key: 'chat', label: 'Chat' },
                                        { key: 'tickets', label: 'Tickets' },
                                        { key: 'contacts', label: 'Contatos' },
                                        { key: 'reports', label: 'Relatórios' },
                                        { key: 'settings', label: 'Configurações' },
                                        { key: 'billing', label: 'Faturamento', adminOnly: true },
                                        { key: 'users', label: 'Usuários', adminOnly: true }
                                    ].map(item => {
                                        if (item.adminOnly && userRole !== 'ADMIN') return null;
                                        return (
                                            <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.9rem" }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={(permissions as any)[item.key]} 
                                                    onChange={e => setPermissions(p => ({ ...p, [item.key]: e.target.checked }))}
                                                    disabled={userRole === 'END_USER'}
                                                    style={{ width: 18, height: 18, accentColor: "var(--accent)", cursor: userRole === 'END_USER' ? 'not-allowed' : 'pointer' }}
                                                />
                                                {item.label}
                                            </label>
                                        );
                                    })}
                                </div>
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
