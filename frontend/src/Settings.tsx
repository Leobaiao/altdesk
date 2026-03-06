import React, { useState, useEffect } from "react";
import { api } from "./lib/api";

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
    const [instanceId, setInstanceId] = useState("");
    const [tokenVal, setTokenVal] = useState("");
    const [instances, setInstances] = useState<any[]>([]);
    const [selectedConnectorId, setSelectedConnectorId] = useState("");

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
                            setInstanceId(active.config?.instance || active.config?.phoneNumberId || "");
                            setTokenVal(active.config?.token || active.config?.accessToken || active.config?.apiKey || "");
                        } else if (data.instances.length > 0) {
                            setSelectedConnectorId(data.instances[0].ConnectorId);
                        }
                    }
                }
            }).catch(err => {
                console.error("Erro ao carregar configurações:", err);
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
            setInstanceId(inst.config?.instance || inst.config?.phoneNumberId || "");
            setTokenVal(inst.config?.token || inst.config?.accessToken || inst.config?.apiKey || "");
        }
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
                    await api.put("/api/settings", {
                        defaultProvider,
                        connectorId: selectedConnectorId,
                        instanceId,
                        token: tokenVal
                    });
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24 }}>
                {/* Perfil + Aparência */}
                <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                            👤 Perfil Pessoal
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
                        <div>
                            <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Nome Completo</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Seu nome"
                                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Cargo / Função (Opcional)</label>
                            <input
                                type="text"
                                value={position}
                                onChange={e => setPosition(e.target.value)}
                                placeholder="Ex: Atendente, Gerente..."
                                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>URL da Foto (Avatar)</label>
                            <input
                                type="text"
                                value={avatar}
                                onChange={e => setAvatar(e.target.value)}
                                placeholder="https://..."
                                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Nova Senha</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                            />
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 6 }}>Deixe em branco para não alterar.</p>
                        </div>
                    </div>
                </div>

                {/* Integração (Only for Admins) */}
                {isAdmin && (
                    <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 24 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                            🔌 Integração (Admin)
                        </h3>

                        {instances.length === 0 ? (
                            <div style={{ padding: 15, background: "rgba(234, 67, 53, 0.1)", color: "#ea4335", borderRadius: 8, fontSize: "0.9rem", border: "1px solid rgba(234, 67, 53, 0.2)" }}>
                                Nenhuma instância de conexão encontrada para essa empresa. Contate o Super Admin.
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Instância Padrão</label>
                                    <select
                                        value={selectedConnectorId}
                                        onChange={e => handleInstanceChange(e.target.value)}
                                        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                                    >
                                        {instances.map(inst => (
                                            <option key={inst.ConnectorId} value={inst.ConnectorId}>
                                                {inst.ChannelName || 'Sem Nome'} ({inst.Provider})
                                            </option>
                                        ))}
                                    </select>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 8 }}>
                                        Provider Mapeado: <strong style={{ color: "var(--accent)" }}>{defaultProvider}</strong>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Instance ID / Phone ID</label>
                                    <input
                                        type="text"
                                        value={instanceId}
                                        onChange={e => setInstanceId(e.target.value)}
                                        placeholder="Ex: instance_12345"
                                        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Token / Access Token</label>
                                    <input
                                        type="password"
                                        value={tokenVal}
                                        onChange={e => setTokenVal(e.target.value)}
                                        placeholder="Ex: abc-123-xyz"
                                        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                                    />
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: "auto", paddingTop: 20 }}>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ width: "100%", padding: "14px", borderRadius: 10, fontWeight: 600, fontSize: "1rem" }}
                            >
                                {loading ? "Salvando..." : "Salvar Todas as Alterações"}
                            </button>
                        </div>
                    </div>
                )}

                {/* AGENT Save Button (Only if not Admin, because Admin has its own button in the Integration section) */}
                {!isAdmin && (
                    <div style={{ marginTop: 20 }}>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ width: "100%", padding: "14px", borderRadius: 10, fontWeight: 600, fontSize: "1rem" }}
                        >
                            {loading ? "Salvando..." : "Salvar Perfil"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
