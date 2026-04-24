import React, { useState, useEffect } from "react";
import { api } from "./lib/api";
import { User, Briefcase, Image as ImageIcon, Lock, MonitorSmartphone, KeySquare, Blocks, ShieldCheck, PhoneCall, Mail, Server, Inbox } from "lucide-react";
import { EmailChannelsTab } from "./components/EmailChannelsTab";

interface Props {
    token: string;
    onBack: () => void;
    role: string;
}

export function Settings({ token, onBack, role }: Props) {
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [avatar, setAvatar] = useState("");
    const [position, setPosition] = useState("");

    const isSafeUrl = (url: string) => {
        if (!url) return false;
        return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/");
    };

    // Theme
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

    // Config states
    const [defaultProvider, setDefaultProvider] = useState("GTI");
    const [instanceId, setInstanceId] = useState("");
    const [tokenVal, setTokenVal] = useState("");
    const [instances, setInstances] = useState<any[]>([]);
    const [selectedConnectorId, setSelectedConnectorId] = useState("");

    // SMTP-specific states
    const [smtpHost, setSmtpHost] = useState("");
    const [smtpPort, setSmtpPort] = useState("");
    const [smtpUser, setSmtpUser] = useState("");
    const [smtpPass, setSmtpPass] = useState("");
    const [smtpFrom, setSmtpFrom] = useState("");
    const [smtpSecure, setSmtpSecure] = useState(false);

    // UI states
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [activeTab, setActiveTab] = useState("profile");
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
                            // Populate SMTP fields if applicable
                            if (active.Provider === "SMTP") {
                                setSmtpHost(active.config?.host || "");
                                setSmtpPort(String(active.config?.port || "587"));
                                setSmtpUser(active.config?.user || "");
                                setSmtpPass(active.config?.pass || "");
                                setSmtpFrom(active.config?.from || "");
                                setSmtpSecure(active.config?.secure || false);
                            }
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
            // Populate SMTP fields
            if (inst.Provider === "SMTP") {
                setSmtpHost(inst.config?.host || "");
                setSmtpPort(String(inst.config?.port || "587"));
                setSmtpUser(inst.config?.user || "");
                setSmtpPass(inst.config?.pass || "");
                setSmtpFrom(inst.config?.from || "");
                setSmtpSecure(inst.config?.secure || false);
            }
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
                    const payload: any = {
                        defaultProvider,
                        connectorId: selectedConnectorId,
                    };
                    if (defaultProvider === "SMTP") {
                        payload.smtpHost = smtpHost;
                        payload.smtpPort = parseInt(smtpPort) || 587;
                        payload.smtpUser = smtpUser;
                        payload.smtpPass = smtpPass;
                        payload.smtpFrom = smtpFrom;
                        payload.smtpSecure = smtpSecure;
                    } else {
                        payload.instanceId = instanceId;
                        payload.token = tokenVal;
                    }
                    await api.put("/api/settings", payload);
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
            {/* Header com Abas */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
                <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "1.2rem", cursor: "pointer", marginRight: 15 }}>←</button>
                <h2 style={{ fontSize: "1.8rem", fontWeight: 700, margin: 0 }}>Configurações</h2>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 32, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                <button 
                    onClick={() => setActiveTab("profile")}
                    style={{ 
                        padding: "10px 20px", borderRadius: 10, cursor: "pointer", border: "none", 
                        background: activeTab === "profile" ? "var(--accent)" : "transparent",
                        color: activeTab === "profile" ? "#fff" : "var(--text-secondary)",
                        fontWeight: 600, display: "flex", alignItems: "center", gap: 8
                    }}
                >
                    <User size={18} /> Perfil e Sistema
                </button>
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab("email")}
                        style={{ 
                            padding: "10px 20px", borderRadius: 10, cursor: "pointer", border: "none", 
                            background: activeTab === "email" ? "var(--accent)" : "transparent",
                            color: activeTab === "email" ? "#fff" : "var(--text-secondary)",
                            fontWeight: 600, display: "flex", alignItems: "center", gap: 8
                        }}
                    >
                        <Mail size={18} /> Canais de E-mail
                    </button>
                )}
            </div>

            {/* Conteúdo das Abas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {activeTab === "profile" && (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24 }}>
                            {/* Perfil + Aparência */}
                            <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                                        <User size={20} className="text-accent" /> Perfil Pessoal
                                    </h3>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-primary)", borderRadius: 8, padding: 3 }}>
                                        <button onClick={() => toggleTheme("dark")} style={{ padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: theme === "dark" ? "var(--accent)" : "transparent", border: "none", color: theme === "dark" ? "#fff" : "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>🌙 Escuro</button>
                                        <button onClick={() => toggleTheme("light")} style={{ padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: theme === "light" ? "var(--accent)" : "transparent", border: "none", color: theme === "light" ? "#fff" : "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600 }}>☀️ Claro</button>
                                    </div>
                                </div>

                                {msg && (
                                    <div style={{ padding: "16px", background: msg.includes("✅") ? "rgba(0, 168, 132, 0.1)" : "rgba(234, 67, 53, 0.1)", color: msg.includes("✅") ? "var(--accent)" : "#ea4335", borderRadius: 12, fontSize: "0.95rem", border: "1px solid", borderColor: msg.includes("✅") ? "rgba(0, 168, 132, 0.2)" : "rgba(234, 67, 53, 0.2)", fontWeight: 500 }}>
                                        {msg}
                                    </div>
                                )}

                                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                                        <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--accent)", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {avatar && isSafeUrl(avatar) ? <img src={avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={40} color="var(--text-secondary)" opacity={0.5} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}><ImageIcon size={14} /> URL da Foto</label>
                                            <input type="text" value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://" className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}><User size={14} /> Nome Completo</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }} />
                                    </div>
                                    <div>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}><Lock size={14} /> Nova Senha</label>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }} />
                                    </div>
                                </div>
                            </div>

                            {/* Integração WhatsApp/GTI Legada */}
                            {isAdmin && (
                                <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 24 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                                        <PhoneCall size={20} className="text-accent" /> WhatsApp e Legados
                                    </h3>

                                    {instances.length === 0 ? (
                                        <div style={{ padding: 15, background: "rgba(234, 67, 53, 0.1)", color: "#ea4335", borderRadius: 10, fontSize: "0.9rem", border: "1px solid rgba(234, 67, 53, 0.2)" }}>
                                            Nenhuma instância encontrada.
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                            <div>
                                                <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Instância Padrão</label>
                                                <select value={selectedConnectorId} onChange={e => handleInstanceChange(e.target.value)} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                                                    {instances.map(inst => <option key={inst.ConnectorId} value={inst.ConnectorId}>{inst.ChannelName} ({inst.Provider})</option>)}
                                                </select>
                                            </div>
                                            {defaultProvider !== "SMTP" && (
                                                <>
                                                    <div>
                                                        <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Instance ID</label>
                                                        <input type="text" value={instanceId} onChange={e => setInstanceId(e.target.value)} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }} />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: "block", marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Token</label>
                                                        <input type="password" value={tokenVal} onChange={e => setTokenVal(e.target.value)} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }} />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Botão Salvar (Apenas para Profile) */}
                        <div style={{ marginTop: 8, padding: "20px 30px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Salvar Alterações</h4>
                                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Perfil e integrações legadas.</p>
                            </div>
                            <button onClick={handleSave} disabled={loading} className="btn btn-primary" style={{ padding: "14px 40px", borderRadius: 10, fontWeight: 600 }}>
                                {loading ? "Salvando..." : "Salvar Tudo"}
                            </button>
                        </div>
                    </>
                )}

                {activeTab === "email" && isAdmin && (
                    <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 16, border: "1px solid var(--border)" }}>
                        <EmailChannelsTab />
                    </div>
                )}
            </div>
        </div>
    );
}
