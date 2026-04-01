import React, { useState, useEffect } from "react";
import { api } from "./lib/api";
import { User, Briefcase, Image as ImageIcon, Lock, MonitorSmartphone, KeySquare, Blocks, ShieldCheck, PhoneCall } from "lucide-react";

interface Props {
    token: string;
    onBack: () => void;
    role: string;
}

export function Settings({ token, onBack, role }: Props) {
    // Perfil states
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [avatar, setAvatar] = useState("");
    const [position, setPosition] = useState("");

    // Theme
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

    // Config states
    const [defaultProvider, setDefaultProvider] = useState("GTI");
    const [instances, setInstances] = useState<any[]>([]);
    const [selectedConnectorId, setSelectedConnectorId] = useState("");
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [assignedToInstance, setAssignedToInstance] = useState<string[]>([]);

    // UI states
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

    function toggleTheme(newTheme: string) {
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
        document.documentElement.setAttribute("data-theme", newTheme === "light" ? "light" : "");
    }

    useEffect(() => {
        // Load configurations (Only for admins)
        if (isAdmin) {
            api.get("/api/settings").then(res => {
                if (res.data) { // Ensure data exists before processing
                    const data = res.data;
                    setDefaultProvider(data.defaultProvider || "GTI");
                    if (data.instances && Array.isArray(data.instances)) {
                        setInstances(data.instances);
                        const active = data.instances.find((i: any) => i.Provider === data.defaultProvider);
                        if (active) {
                            setSelectedConnectorId(active.ConnectorId);
                            setAssignedToInstance(active.assignedUsers?.map((u: any) => u.UserId) || []);
                        } else if (data.instances.length > 0) {
                            setSelectedConnectorId(data.instances[0].ConnectorId);
                            setAssignedToInstance(data.instances[0].assignedUsers?.map((u: any) => u.UserId) || []);
                        }
                    }
                }
            }).catch(err => {
                console.error("Erro ao carregar configurações:", err);
            });

            api.get("/api/users").then(res => {
                setAllUsers((res.data || []).filter((u: any) => u.IsActive));
            }).catch(err => {
                console.error("Erro ao carregar usuários:", err);
            });
        }

        // Load profile
        api.get("/api/profile").then(res => {
            if (res.data) { // Ensure data exists before processing
                const data = res.data;
                setName(data.Name || "");
                setAvatar(data.Avatar || "");
                setPosition(data.Position || "");
            }
        }).catch(err => {
            console.error("Erro ao carregar perfil:", err);
        });
    }, [isAdmin]);

    function handleInstanceChange(cId: string) {
        setSelectedConnectorId(cId);
        const inst = instances.find(i => i.ConnectorId === cId);
        if (inst) {
            setDefaultProvider(inst.Provider);
            setAssignedToInstance(inst.assignedUsers?.map((u: any) => u.UserId) || []);
        }
    }

    function handleToggleUser(userId: string) {
        setAssignedToInstance(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    }

    const handleSave = async () => {
        setLoading(true);
        setMsg("");
        try {
            // 1. Profile update (Always try)
            try {
                await api.put("/api/profile", {
                    name: name || undefined,
                    password: password || undefined,
                    avatar: avatar || undefined,
                    position: position || undefined
                });
            } catch (err: any) {
                const errorMsg = err.response?.data?.error || err.message;
                throw new Error("Erro no Perfil: " + errorMsg);
            }

            // 2. Settings update (Only if Admin and has instances)
            if (isAdmin && selectedConnectorId) {
                try {
                    // Update default provider
                    await api.put("/api/settings", {
                        defaultProvider,
                        connectorId: selectedConnectorId
                    });

                    // 2b. Assign users
                    await api.post(`/api/settings/instances/${selectedConnectorId}/assignments`, {
                        userIds: assignedToInstance
                    });

                    // Update local instances state to reflect new assignments
                    setInstances((prev: any[]) => prev.map((inst: any) => 
                        inst.ConnectorId === selectedConnectorId 
                            ? { ...inst, assignedUsers: allUsers.filter(u => assignedToInstance.includes(u.UserId)) }
                            : inst
                    ));

                } catch (err: any) {
                    const errorMsg = err.response?.data?.error || err.message;
                    throw new Error("Erro na Integração: " + errorMsg);
                }
            }

            setMsg("✅ Alterações salvas com sucesso!");
            setPassword("");
        } catch (err: any) {
            setMsg("❌ " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="settings-page">
            <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
                <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "1.2rem", cursor: "pointer", marginRight: 15 }}>←</button>
                <h2 style={{ fontSize: "1.8rem", fontWeight: 700 }}>Configurações</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
                {/* Perfil + Aparência */}
                <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                            <User size={20} className="text-accent" /> Perfil Pessoal
                        </h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-primary)", borderRadius: 8, padding: 3 }}>
                            <button
                                onClick={() => toggleTheme("dark")}
                                style={{
                                    padding: "6px 14px", borderRadius: 6, cursor: "pointer", transition: "all 0.2s",
                                    background: theme === "dark" ? "var(--accent)" : "transparent",
                                    border: "none", color: theme === "dark" ? "#fff" : "var(--text-secondary)",
                                    fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 5
                                }}
                            >
                                🌙 Escuro
                            </button>
                            <button
                                onClick={() => toggleTheme("light")}
                                style={{
                                    padding: "6px 14px", borderRadius: 6, cursor: "pointer", transition: "all 0.2s",
                                    background: theme === "light" ? "var(--accent)" : "transparent",
                                    border: "none", color: theme === "light" ? "#fff" : "var(--text-secondary)",
                                    fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 5
                                }}
                            >
                                ☀️ Claro
                            </button>
                        </div>
                    </div>

                    {msg && (
                        <div style={{
                            padding: "16px",
                            background: msg.includes("✅") ? "rgba(0, 168, 132, 0.1)" : "rgba(234, 67, 53, 0.1)",
                            color: msg.includes("✅") ? "var(--accent)" : "#ea4335",
                            borderRadius: 12,
                            fontSize: "0.95rem",
                            border: "1px solid",
                            borderColor: msg.includes("✅") ? "rgba(0, 168, 132, 0.2)" : "rgba(234, 67, 53, 0.2)",
                            fontWeight: 500
                        }}>
                            {msg}
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                            {/* Avatar Preview */}
                            <div style={{ 
                                width: 80, 
                                height: 80, 
                                borderRadius: "50%", 
                                overflow: "hidden", 
                                border: "2px solid var(--accent)",
                                background: "var(--bg-primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                            }}>
                                {avatar ? (
                                    <img src={avatar} alt="Avatar Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => (e.currentTarget.src = "")} />
                                ) : (
                                    <User size={40} color="var(--text-secondary)" opacity={0.5} />
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                    <ImageIcon size={14} /> URL da Foto (Avatar)
                                </label>
                                <input
                                    type="text"
                                    value={avatar}
                                    onChange={e => setAvatar(e.target.value)}
                                    placeholder="https://"
                                    className="settings-input"
                                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                <User size={14} /> Nome Completo
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
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
                                value={position}
                                onChange={e => setPosition(e.target.value)}
                                placeholder="Ex: Atendente, Gerente..."
                                className="settings-input"
                                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                <Lock size={14} /> Nova Senha
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="settings-input"
                                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }}
                            />
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 6 }}>Deixe em branco para não alterar.</p>
                        </div>
                    </div>
                </div>

                {/* Integração (Only for Admins) */}
                {isAdmin && (
                    <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 24, height: "fit-content" }}>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                            <Blocks size={20} className="text-accent" /> Integração de Canais
                        </h3>

                        {instances.length === 0 ? (
                            <div style={{ padding: 15, background: "rgba(234, 67, 53, 0.1)", color: "#ea4335", borderRadius: 10, fontSize: "0.9rem", border: "1px solid rgba(234, 67, 53, 0.2)" }}>
                                Nenhuma instância de conexão encontrada para essa empresa. Contate o Super Admin.
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                <div>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                        <MonitorSmartphone size={14} /> Selecione a Instância (Canal)
                                    </label>
                                    <select
                                        value={selectedConnectorId}
                                        onChange={e => handleInstanceChange(e.target.value)}
                                        className="settings-input"
                                        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }}
                                    >
                                        {instances.map(inst => (
                                            <option key={inst.ConnectorId} value={inst.ConnectorId}>
                                                {inst.ChannelName || 'Sem Nome'} ({inst.Provider})
                                            </option>
                                        ))}
                                    </select>
                                </div>



                                <div style={{ marginTop: 10 }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                        <User size={14} /> Funcionários com Acesso
                                    </label>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 200, overflowY: "auto", padding: 12, background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)" }}>
                                        {allUsers.length === 0 ? (
                                            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Nenhum funcionário encontrado.</span>
                                        ) : (
                                            allUsers.map(u => (
                                                <label key={u.UserId} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.85rem" }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={assignedToInstance.includes(u.UserId)}
                                                        onChange={() => handleToggleUser(u.UserId)}
                                                        style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                                                    />
                                                    <span>{u.AgentName || u.DisplayName || u.Email}</span>
                                                    {u.Role === 'ADMIN' && <span style={{ fontSize: "0.7rem", padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: 4, color: "var(--text-secondary)" }}>Admin</span>}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 8 }}>
                                        Se nenhum for selecionado, a instância será <strong>Global</strong> (todos acessam).
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Unified Save Action */}
            <div style={{ 
                marginTop: 32, 
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
                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Salvar Configurações</h4>
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        Ao clicar em salvar, suas alterações de perfil e sistema (se aplicável) serão atualizadas.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ padding: "14px 40px", borderRadius: 10, fontWeight: 600, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}
                >
                    <ShieldCheck size={18} />
                    {loading ? "Salvando..." : "Salvar Tudo"}
                </button>
            </div>
        </div>
    );
}
