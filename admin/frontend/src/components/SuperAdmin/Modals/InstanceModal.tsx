import React, { useState } from "react";
import { Smartphone, Globe, Mail, Server } from "lucide-react";
import { api } from "../../../lib/api";
import { useNotification } from "../../../contexts/NotificationContext";

interface InstanceModalProps {
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    tenants: any[];
    initialData?: any;
}

export function InstanceModal({ onClose, onSubmit, tenants, initialData }: InstanceModalProps) {
    const [instName, setInstName] = useState("");
    const [instProvider, setInstProvider] = useState("GTI");
    const [instConfig, setInstConfig] = useState("");
    const [tenantId, setTenantId] = useState(tenants[0]?.TenantId || "");
    const [smtpSecure, setSmtpSecure] = useState(false);
    const { notify } = useNotification();

    // GTI Specific Form State
    const [gtiToken, setGtiToken] = useState("");
    const [gtiInstanceId, setGtiInstanceId] = useState("");
    const [gtiPhoneId, setGtiPhoneId] = useState("");

    // SMTP (Email) Specific Form State
    const [smtpHost, setSmtpHost] = useState("");
    const [smtpPort, setSmtpPort] = useState("587");
    const [smtpUser, setSmtpUser] = useState("");
    const [smtpPass, setSmtpPass] = useState("");
    const [smtpFrom, setSmtpFrom] = useState("");

    React.useEffect(() => {
        if (initialData) {
            setInstName(initialData.ChannelName || "");
            setInstProvider(initialData.Provider || "GTI");
            setTenantId(initialData.TenantId || "");
            
            if (initialData.ConfigJson) {
                try {
                    const config = typeof initialData.ConfigJson === 'string' 
                        ? JSON.parse(initialData.ConfigJson) 
                        : initialData.ConfigJson;
                    
                    if (initialData.Provider === "GTI") {
                        setGtiToken(config.apiKey || "");
                        setGtiInstanceId(config.instanceId || "");
                        setGtiPhoneId(config.phoneNumberId || "");
                    } else if (initialData.Provider === "SMTP") {
                        setSmtpHost(config.host || "");
                        setSmtpPort(config.port?.toString() || "587");
                        setSmtpUser(config.user || "");
                        setSmtpPass(config.pass || "");
                        setSmtpFrom(config.from || "");
                        setSmtpSecure(!!config.secure);
                    } else {
                        setInstConfig(JSON.stringify(config, null, 2));
                    }
                } catch (e) {
                    setInstConfig(initialData.ConfigJson);
                }
            }
        }
    }, [initialData, tenants]);

    const handleFetchGtiInfo = async () => {
        if (!gtiToken) return notify("Insira o token GTI", "info");
        try {
            const r = await api.get(`/api/admin/instances/gti-info?token=${gtiToken}`);
            const data = r.data;
            if (data.instance) {
                setGtiInstanceId(data.instance.id);
                setGtiPhoneId(data.instance.owner || data.instance.number || "");
                notify("Informações da GTI carregadas", "success");
            }
        } catch (err) {
            console.error(err);
            notify("Erro ao buscar info da GTI. Verifique o token.", "error");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return notify("Selecione uma empresa", "info");

        let finalConfig = instConfig;
        if (instProvider === "GTI") {
            finalConfig = JSON.stringify({
                apiKey: gtiToken,
                instanceId: gtiInstanceId,
                phoneNumberId: gtiPhoneId
            });
        } else if (instProvider === "SMTP") {
            finalConfig = JSON.stringify({
                host: smtpHost,
                port: parseInt(smtpPort) || 587,
                secure: smtpSecure,
                user: smtpUser,
                pass: smtpPass,
                from: smtpFrom || `"AltDesk" <${smtpUser}>`
            });
        }

        await onSubmit({
            tenantId,
            name: instName,
            provider: instProvider,
            config: finalConfig
        });
        onClose();
    };

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
            <div className="admin-modal" style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                width: "100%", maxWidth: 520,
                padding: 32,
                borderRadius: 20,
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    {instProvider === "SMTP" ? <Mail size={24} className="text-accent" /> : <Smartphone size={24} className="text-accent" />}
                    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                        {initialData ? "Editar Instância" : "Nova Instância"}
                    </h2>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 28 }}>
                    {initialData ? `Editando configurações da instância ${initialData.ConnectorId.slice(0,8)}` : "Conecte um novo canal de comunicação ao sistema."}
                </p>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Empresa (Dona)</label>
                        <select required value={tenantId} onChange={e => setTenantId(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                            <option value="">Selecione uma empresa...</option>
                            {tenants.map(t => (
                                <option key={t.TenantId} value={t.TenantId}>{t.Name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Nome do Canal</label>
                        <input required value={instName} onChange={e => setInstName(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)" }} placeholder="EX: WhatsApp Comercial" />
                    </div>

                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Provedor</label>
                        <select value={instProvider} onChange={e => setInstProvider(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                            <option value="GTI">GTI (WhatsApp)</option>
                            <option value="WHATSAPP">WhatsApp Business API</option>
                            <option value="OFFICIAL">Official Cloud API</option>
                            <option value="SMTP">✉️ Email (SMTP)</option>
                        </select>
                    </div>

                    {instProvider === "GTI" ? (
                        <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Globe size={16} className="text-secondary" />
                                <span style={{ fontSize: "0.80rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Configuração GTI</span>
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Token (API Key)*</label>
                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                    <input
                                        required
                                        value={gtiToken}
                                        onChange={e => setGtiToken(e.target.value)}
                                        style={{ flex: 1, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                        placeholder="Token da instância"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleFetchGtiInfo}
                                        className="btn btn-primary"
                                        style={{ padding: "0 16px", borderRadius: 10, fontSize: "0.8rem" }}
                                    >
                                        Verificar
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div className="field">
                                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Instance ID</label>
                                    <input
                                        value={gtiInstanceId}
                                        readOnly
                                        style={{ width: "100%", marginTop: 8, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text-secondary)", opacity: 0.8 }}
                                    />
                                </div>
                                <div className="field">
                                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Phone / Owner</label>
                                    <input
                                        value={gtiPhoneId}
                                        readOnly
                                        style={{ width: "100%", marginTop: 8, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text-secondary)", opacity: 0.8 }}
                                    />
                                </div>
                            </div>
                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", margin: 0, fontStyle: "italic" }}>
                                Os campos Instance ID e Phone são preenchidos ao validar o token.
                            </p>
                        </div>
                    ) : instProvider === "SMTP" ? (
                        <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Mail size={16} className="text-secondary" />
                                <span style={{ fontSize: "0.80rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Configuração SMTP</span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                                <div className="field">
                                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Host SMTP*</label>
                                    <input
                                        required
                                        value={smtpHost}
                                        onChange={e => setSmtpHost(e.target.value)}
                                        style={{ width: "100%", marginTop: 8, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                        placeholder="smtp.gmail.com"
                                    />
                                </div>
                                <div className="field">
                                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Porta*</label>
                                    <input
                                        required
                                        type="number"
                                        value={smtpPort}
                                        onChange={e => setSmtpPort(e.target.value)}
                                        style={{ width: "100%", marginTop: 8, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                        placeholder="587"
                                    />
                                </div>
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Usuário (E-mail)*</label>
                                <input
                                    required
                                    value={smtpUser}
                                    onChange={e => setSmtpUser(e.target.value)}
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                    placeholder="suporte@empresa.com"
                                />
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Senha*</label>
                                <input
                                    required
                                    type="password"
                                    value={smtpPass}
                                    onChange={e => setSmtpPass(e.target.value)}
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                    placeholder="Senha ou App Password"
                                />
                            </div>

                            <div className="field">
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Remetente (From)</label>
                                <input
                                    value={smtpFrom}
                                    onChange={e => setSmtpFrom(e.target.value)}
                                    style={{ width: "100%", marginTop: 8, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                    placeholder='"AltDesk Suporte" <suporte@empresa.com>'
                                />
                                <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", margin: "6px 0 0 0", fontStyle: "italic" }}>
                                    Deixe em branco para usar o e-mail do usuário como remetente.
                                </p>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
                                <input
                                    type="checkbox"
                                    checked={smtpSecure}
                                    onChange={e => setSmtpSecure(e.target.checked)}
                                    style={{ accentColor: "var(--accent)", width: 16, height: 16, cursor: "pointer" }}
                                    id="smtp-secure"
                                />
                                <label htmlFor="smtp-secure" style={{ fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>
                                    <Server size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                                    Conexão Segura (SSL/TLS)
                                </label>
                            </div>
                        </div>
                    ) : (
                        <div className="field">
                            <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Config JSON</label>
                            <textarea
                                required
                                value={instConfig}
                                onChange={e => setInstConfig(e.target.value)}
                                rows={4}
                                style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)", fontFamily: "monospace", fontSize: "0.85rem" }}
                                placeholder='{"apiKey": "xyz", "phoneNumberId": "123"}'
                            />
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 12 }}>
                        <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: "12px 24px", borderRadius: 12 }}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" style={{ padding: "12px 24px", borderRadius: 12 }}>
                            {initialData ? "Salvar Alterações" : "Criar Instância"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
