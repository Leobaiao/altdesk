import React, { useState, useEffect } from "react";
import { api } from "./lib/api";
import { PageHeader } from "./components/PageHeader";
import { User, Briefcase, Image as ImageIcon, Lock, MonitorSmartphone, KeySquare, Blocks, ShieldCheck, PhoneCall, Settings as SettingsIcon, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseJwt } from "./lib/auth";
import { EmailChannelsTab } from "./components/EmailChannelsTab";
interface Props {
    token: string;
    onBack: () => void;
    role: string;
    livePermissions?: any;
}

export function Settings({ token, onBack, role, livePermissions }: Props) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("integrations");

    const isSafeUrl = (url: string) => {
        if (!url) return false;
        return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/");
    };

    // Config states
    const [defaultProvider, setDefaultProvider] = useState("GTI");
    const [instances, setInstances] = useState<any[]>([]);
    const [selectedConnectorId, setSelectedConnectorId] = useState("");
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [assignedToInstance, setAssignedToInstance] = useState<string[]>([]);

    // UI states
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const decoded = parseJwt(token);
    const userPermissions = livePermissions || decoded?.permissions || {};
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

    useEffect(() => {
        // Load configurations (Only for admins)
        if (isAdmin) {
            api.get("/api/settings").then(res => {
                if (res.data) {
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

    const handleSaveIntegrations = async () => {
        setLoading(true);
        setMsg("");
        try {
            if (selectedConnectorId) {
                await api.put("/api/settings", {
                    defaultProvider,
                    connectorId: selectedConnectorId
                });

                await api.post(`/api/settings/instances/${selectedConnectorId}/assignments`, {
                    userIds: assignedToInstance
                });

                setInstances((prev: any[]) => prev.map((inst: any) => 
                    inst.ConnectorId === selectedConnectorId 
                        ? { ...inst, assignedUsers: allUsers.filter(u => assignedToInstance.includes(u.UserId)) }
                        : inst
                ));
                setMsg("✅ Configurações de integração salvas com sucesso!");
            } else {
                setMsg("❌ Nenhuma instância selecionada.");
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message;
            setMsg("❌ Erro na Integração: " + errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const navItems = [
        { label: "Calendário (Horários)", path: "/business-hours", desc: "Cronograma e expedientes", perm: "settings" },
        { label: "Respostas Rápidas", path: "/canned", desc: "Atalhos de texto", perm: "settings" },
        { label: "Base de Conhecimento", path: "/knowledge", desc: "Arquivos e links", perm: "settings" },
        { label: "Sistema de Ajuda", path: "/help-admin", desc: "Gerenciar ajuda contextual", perm: "settings" },
        { label: "Filas de Atendimento", path: "/queues", desc: "Roteamento de chats", perm: "settings" },
        { label: "Tags", path: "/tags", desc: "Categorização", perm: "settings" },
        { label: "Faturamento", path: "/billing", desc: "Gestão de assinaturas", perm: "billing" },
        { label: "Logs de Auditoria", path: "/audit", desc: "Histórico de ações", perm: "users" } // Audit usually for user managers
    ].filter(item => {
        if (role === 'SUPERADMIN') return true;
        if (role === 'END_USER' && (item.path === '/canned' || item.path === '/knowledge')) return true;
        return userPermissions[item.perm] !== false;
    });

    return (
        <div className="settings-page" style={{ height: "100%", overflowY: "auto", padding: "24px" }}>
            <PageHeader
                title="Configurações da Empresa"
                subtitle="Ajuste dados básicos da sua conta e preferências globais."
                icon={SettingsIcon}
                onBack={onBack}
                contextKey="settings.index"
                helpText={
                    <div>
                        <p>Configure as preferências do seu perfil e o comportamento global da plataforma para sua empresa.</p>
                    </div>
                }
            />

            {/* Config Navigation */}
            {navItems.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
                    {navItems.map(item => (
                        <div 
                            key={item.path} 
                            onClick={() => navigate(item.path)}
                            style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.2s" }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                        >
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{item.label}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{item.desc}</div>
                        </div>
                    ))}
                </div>
            )}

            {isAdmin && (
                <div style={{ display: "flex", gap: 12, marginBottom: 32, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                    <button 
                        onClick={() => { setActiveTab("integrations"); setMsg(""); }}
                        style={{ 
                            padding: "10px 20px", borderRadius: 10, cursor: "pointer", border: "none", 
                            background: activeTab === "integrations" ? "var(--accent)" : "transparent",
                            color: activeTab === "integrations" ? "#fff" : "var(--text-secondary)",
                            fontWeight: 600, display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s"
                        }}
                    >
                        <Blocks size={18} /> Integração de Canais
                    </button>
                    <button 
                        onClick={() => { setActiveTab("email"); setMsg(""); }}
                        style={{ 
                            padding: "10px 20px", borderRadius: 10, cursor: "pointer", border: "none", 
                            background: activeTab === "email" ? "var(--accent)" : "transparent",
                            color: activeTab === "email" ? "#fff" : "var(--text-secondary)",
                            fontWeight: 600, display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s"
                        }}
                    >
                        <Mail size={18} /> Canais de E-mail
                    </button>
                </div>
            )}

            {msg && (
                <div style={{
                    padding: "16px",
                    background: msg.includes("✅") ? "rgba(0, 168, 132, 0.1)" : "rgba(234, 67, 53, 0.1)",
                    color: msg.includes("✅") ? "var(--accent)" : "#ea4335",
                    borderRadius: 12,
                    fontSize: "0.95rem",
                    border: "1px solid",
                    borderColor: msg.includes("✅") ? "rgba(0, 168, 132, 0.2)" : "rgba(234, 67, 53, 0.2)",
                    fontWeight: 500,
                    marginBottom: 24,
                    maxWidth: 650
                }}>
                    {msg}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {activeTab === "integrations" && isAdmin && (
                    instances.length === 0 ? (
                        <div style={{ 
                            display: "flex", 
                            flexDirection: "column", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            padding: "60px 40px", 
                            background: "var(--bg-secondary)", 
                            border: "1px solid var(--border)", 
                            borderRadius: 20,
                            textAlign: "center",
                            maxWidth: 600,
                            margin: "0 auto"
                        }}>
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                background: "rgba(0, 168, 132, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 24,
                                color: "var(--accent)"
                            }}>
                                <Blocks size={32} />
                            </div>
                            <h3 style={{ margin: "0 0 10px 0", fontSize: "1.2rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                Nenhum Canal de Chat Ativo
                            </h3>
                            <p style={{ margin: "0 0 20px 0", fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                Não existem instâncias de canais de chat (WhatsApp, Webchat, etc.) configuradas para esta empresa no momento.
                            </p>
                            <div style={{ padding: "12px 18px", background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)", fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: 450 }}>
                                ℹ️ As conexões com canais externos são geridas pelo <strong>Super Administrador</strong>. Se necessita de integrar um canal para a sua empresa, por favor entre em contato com o suporte.
                            </div>
                        </div>
                    ) : (
                        <div style={{ maxWidth: 650, display: "flex", flexDirection: "column", gap: 24 }}>
                            {/* Card de Integração */}
                            <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 24 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                                    <Blocks size={20} className="text-accent" /> Integração de Canais
                                </h3>

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
                            </div>

                            {/* Save Action for Integrations */}
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
                                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Salvar Configurações</h4>
                                    <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                        Atualize a instância padrão de chat e as permissões de acesso dos funcionários.
                                    </p>
                                </div>
                                <button
                                    onClick={handleSaveIntegrations}
                                    disabled={loading}
                                    className="btn btn-primary"
                                    style={{ padding: "14px 40px", borderRadius: 10, fontWeight: 600, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}
                                >
                                    <ShieldCheck size={18} />
                                    {loading ? "Salvando..." : "Salvar Integrações"}
                                </button>
                            </div>
                        </div>
                    )
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
