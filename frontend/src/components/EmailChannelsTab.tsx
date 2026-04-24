import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Mail, Plus, Trash2, CheckCircle2, XCircle, RefreshCw, Server, Shield, Send, Inbox, Settings2, HelpCircle } from "lucide-react";

interface EmailChannel {
    EmailChannelId: string;
    Name: string;
    EmailAddress: string;
    ProviderType: string;
    IsActive: boolean;
    inbound?: any;
    outbound?: any;
    LastSyncAt?: string;
    LastError?: string;
}

export function EmailChannelsTab() {
    const [channels, setChannels] = useState<EmailChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingChannel, setEditingChannel] = useState<any>(null);
    const [testResults, setTestResults] = useState<Record<string, { inbound?: boolean; outbound?: boolean; loadingIn?: boolean; loadingOut?: boolean }>>({});
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        loadChannels();
    }, []);

    const loadChannels = async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/email-channels");
            setChannels(res.data);
        } catch (err) {
            console.error("Erro ao carregar canais de email:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleTestInbound = async (channelId: string) => {
        setTestResults(prev => ({ ...prev, [channelId]: { ...prev[channelId], loadingIn: true } }));
        try {
            await api.post(`/api/email-channels/${channelId}/test-inbound`);
            setTestResults(prev => ({ ...prev, [channelId]: { ...prev[channelId], inbound: true, loadingIn: false } }));
        } catch (err) {
            setTestResults(prev => ({ ...prev, [channelId]: { ...prev[channelId], inbound: false, loadingIn: false } }));
        }
    };

    const handleTestOutbound = async (channelId: string) => {
        setTestResults(prev => ({ ...prev, [channelId]: { ...prev[channelId], loadingOut: true } }));
        try {
            await api.post(`/api/email-channels/${channelId}/test-outbound`);
            setTestResults(prev => ({ ...prev, [channelId]: { ...prev[channelId], outbound: true, loadingOut: false } }));
        } catch (err) {
            setTestResults(prev => ({ ...prev, [channelId]: { ...prev[channelId], outbound: false, loadingOut: false } }));
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tens a certeza que queres remover este canal de email?")) return;
        try {
            await api.delete(`/api/email-channels/${id}`);
            setChannels(prev => prev.filter(c => c.EmailChannelId !== id));
        } catch (err) {
            alert("Erro ao remover canal");
        }
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <RefreshCw className="animate-spin" size={32} color="var(--accent)" />
            </div>
        );
    }

    const handleSaveChannel = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingChannel.EmailChannelId) {
                await api.put(`/api/email-channels/${editingChannel.EmailChannelId}`, editingChannel);
            } else {
                await api.post("/api/email-channels", editingChannel);
            }
            setEditingChannel(null);
            loadChannels();
        } catch (err) {
            alert("Erro ao salvar canal de email");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                        <Mail size={20} className="text-accent" /> Canais de E-mail
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
                        Cada empresa pode configurar as suas próprias contas IMAP/SMTP de forma isolada.
                    </p>
                </div>
                <button 
                    onClick={() => setEditingChannel({ name: "", emailAddress: "", providerType: "imap_smtp", inbound: { imapHost: "", imapPort: 993, imapSecure: true, username: "", password: "", pollIntervalSeconds: 60 }, outbound: { smtpHost: "", smtpPort: 587, smtpSecure: false, username: "", password: "", fromName: "" } })}
                    className="btn btn-primary" 
                    style={{ padding: "8px 16px", borderRadius: 10, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 8 }}
                >
                    <Plus size={18} /> Configurar Novo E-mail
                </button>
            </div>

            {/* Modal de Configuração (Overlay) */}
            {editingChannel && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, animation: "fadeIn 0.2s ease-out" }}>
                    <form onSubmit={handleSaveChannel} style={{ background: "var(--bg-secondary)", width: "100%", maxWidth: 800, borderRadius: 24, border: "1px solid var(--border)", display: "flex", flexDirection: "column", maxHeight: "90vh", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
                        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-primary)", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                                <Mail size={22} className="text-accent" />
                                Configurar Canal de E-mail
                            </h3>
                            <div style={{ display: "flex", gap: 12 }}>
                                <button type="button" onClick={() => setShowHelp(!showHelp)} style={{ background: showHelp ? "var(--accent)" : "rgba(0, 168, 132, 0.1)", border: "none", color: showHelp ? "#fff" : "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: "0.85rem", fontWeight: 600, transition: "all 0.2s" }}>
                                    <HelpCircle size={16} /> Ajuda
                                </button>
                                <button type="button" onClick={() => setEditingChannel(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--border)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                                    <Plus size={24} style={{ transform: "rotate(45deg)" }} />
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: "32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 32 }}>
                            {/* Guia de Ajuda */}
                            {showHelp && (
                                <div style={{ background: "rgba(0, 168, 132, 0.05)", border: "1px solid rgba(0, 168, 132, 0.2)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 12, animation: "fadeIn 0.3s ease-out" }}>
                                    <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: 8 }}>
                                        <HelpCircle size={18} /> Guia de Preenchimento
                                    </h4>
                                    <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-secondary)", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.5 }}>
                                        <li><strong>Nome Identificador:</strong> Um nome interno apenas para organização (ex: "Suporte Técnico", "Vendas").</li>
                                        <li><strong>Endereço de E-mail:</strong> O e-mail exato que os clientes utilizam para comunicar com a empresa.</li>
                                        <li><strong>Servidor IMAP/SMTP:</strong> O endereço do servidor do seu provedor de e-mail (ex: <code style={{ background: "var(--bg-primary)", padding: "2px 6px", borderRadius: 4 }}>imap.gmail.com</code> ou <code style={{ background: "var(--bg-primary)", padding: "2px 6px", borderRadius: 4 }}>smtp.office365.com</code>).</li>
                                        <li><strong>Portas e SSL:</strong> Na maioria dos casos, a porta IMAP (Entrada) é <strong>993</strong> com SSL marcado. A porta SMTP (Saída) costuma ser <strong>587</strong> ou <strong>465</strong> com SSL marcado.</li>
                                        <li><strong style={{ color: "var(--text-primary)" }}>IMPORTANTE (Senhas):</strong> Se você usa <strong>Gmail</strong>, <strong>Microsoft (Outlook)</strong> ou <strong>iCloud</strong>, você <u>NÃO</u> deve usar a sua senha normal. É obrigatório ir às configurações de segurança da sua conta e gerar uma <strong>"Senha de Aplicação"</strong> (App Password) e colocá-la nos campos de Password IMAP e SMTP.</li>
                                    </ul>
                                </div>
                            )}

                            {/* Básico */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Nome Identificador (ex: Suporte)</label>
                                    <input type="text" value={editingChannel.name} onChange={e => setEditingChannel({...editingChannel, name: e.target.value})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }} required />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Endereço de E-mail</label>
                                    <input type="email" value={editingChannel.emailAddress} onChange={e => setEditingChannel({...editingChannel, emailAddress: e.target.value})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", transition: "all 0.2s" }} required />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                                {/* Inbound - IMAP */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 20, background: "var(--bg-primary)", padding: 24, borderRadius: 16, border: "1px solid var(--border)" }}>
                                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
                                        <Inbox size={20} color="var(--accent)" /> Entrada (IMAP)
                                    </h4>
                                    <div>
                                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Servidor IMAP Host</label>
                                        <input type="text" value={editingChannel.inbound.imapHost} onChange={e => setEditingChannel({...editingChannel, inbound: {...editingChannel.inbound, imapHost: e.target.value}})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", transition: "all 0.2s" }} placeholder="imap.gmail.com" required />
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                        <div>
                                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Porta</label>
                                            <input type="number" value={editingChannel.inbound.imapPort} onChange={e => setEditingChannel({...editingChannel, inbound: {...editingChannel.inbound, imapPort: parseInt(e.target.value)}})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", transition: "all 0.2s" }} />
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, height: "100%", paddingTop: 26 }}>
                                            <input type="checkbox" checked={editingChannel.inbound.imapSecure} onChange={e => setEditingChannel({...editingChannel, inbound: {...editingChannel.inbound, imapSecure: e.target.checked}})} id="imap-ssl" style={{ width: 18, height: 18, accentColor: "var(--accent)", cursor: "pointer" }} />
                                            <label htmlFor="imap-ssl" style={{ fontSize: "0.9rem", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>SSL/TLS</label>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Usuário IMAP</label>
                                        <input type="text" value={editingChannel.inbound.username} onChange={e => setEditingChannel({...editingChannel, inbound: {...editingChannel.inbound, username: e.target.value}})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", transition: "all 0.2s" }} required />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Password IMAP</label>
                                        <input type="password" value={editingChannel.inbound.password} onChange={e => setEditingChannel({...editingChannel, inbound: {...editingChannel.inbound, password: e.target.value}})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", transition: "all 0.2s" }} required />
                                    </div>
                                </div>

                                {/* Outbound - SMTP */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 20, background: "var(--bg-primary)", padding: 24, borderRadius: 16, border: "1px solid var(--border)" }}>
                                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
                                        <Send size={20} color="var(--accent)" /> Saída (SMTP)
                                    </h4>
                                    <div>
                                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Servidor SMTP Host</label>
                                        <input type="text" value={editingChannel.outbound.smtpHost} onChange={e => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, smtpHost: e.target.value}})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", transition: "all 0.2s" }} placeholder="smtp.gmail.com" required />
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                        <div>
                                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Porta</label>
                                            <input type="number" value={editingChannel.outbound.smtpPort} onChange={e => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, smtpPort: parseInt(e.target.value)}})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", transition: "all 0.2s" }} />
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, height: "100%", paddingTop: 26 }}>
                                            <input type="checkbox" checked={editingChannel.outbound.smtpSecure} onChange={e => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, smtpSecure: e.target.checked}})} id="smtp-ssl" style={{ width: 18, height: 18, accentColor: "var(--accent)", cursor: "pointer" }} />
                                            <label htmlFor="smtp-ssl" style={{ fontSize: "0.9rem", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>SSL/TLS</label>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Usuário SMTP</label>
                                        <input type="text" value={editingChannel.outbound.username} onChange={e => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, username: e.target.value}})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", transition: "all 0.2s" }} required />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Password SMTP</label>
                                        <input type="password" value={editingChannel.outbound.password} onChange={e => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, password: e.target.value}})} className="settings-input" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", transition: "all 0.2s" }} required />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: "24px 32px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 12, background: "var(--bg-primary)", borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
                            <button type="button" onClick={() => setEditingChannel(null)} className="btn btn-secondary" style={{ padding: "12px 24px", borderRadius: 12, fontWeight: 600, fontSize: "0.95rem" }}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" style={{ padding: "12px 32px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: "0.95rem" }}>
                                <CheckCircle2 size={20} /> Salvar Configuração
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {channels.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", background: "var(--bg-primary)", borderRadius: 16, border: "2px dashed var(--border)" }}>
                    <Mail size={40} color="var(--text-secondary)" style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p style={{ color: "var(--text-secondary)" }}>Nenhum canal de e-mail configurado.</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                    {channels.map(channel => (
                        <div key={channel.EmailChannelId} style={{ 
                            background: "var(--bg-primary)", 
                            borderRadius: 16, 
                            border: "1px solid var(--border)",
                            overflow: "hidden"
                        }}>
                            <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{ display: "flex", gap: 16 }}>
                                    <div style={{ 
                                        width: 48, height: 48, borderRadius: 12, background: "rgba(0, 168, 132, 0.1)", 
                                        display: "flex", alignItems: "center", justifyItems: "center", color: "var(--accent)" 
                                    }}>
                                        <Mail size={24} style={{ margin: "auto" }} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>{channel.Name}</h4>
                                        <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{channel.EmailAddress}</p>
                                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                            <span style={{ fontSize: "0.7rem", padding: "2px 8px", background: "var(--bg-secondary)", borderRadius: 4, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
                                                {channel.ProviderType}
                                            </span>
                                            {channel.IsActive ? 
                                                <span style={{ fontSize: "0.7rem", padding: "2px 8px", background: "rgba(0, 168, 132, 0.1)", borderRadius: 4, color: "var(--accent)", fontWeight: 600 }}>ATIVO</span> :
                                                <span style={{ fontSize: "0.7rem", padding: "2px 8px", background: "rgba(234, 67, 53, 0.1)", borderRadius: 4, color: "#ea4335", fontWeight: 600 }}>INATIVO</span>
                                            }
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: 8 }}>
                                    <button 
                                        onClick={() => handleTestInbound(channel.EmailChannelId)}
                                        disabled={testResults[channel.EmailChannelId]?.loadingIn}
                                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}
                                    >
                                        <Inbox size={14} /> 
                                        {testResults[channel.EmailChannelId]?.loadingIn ? "A testar..." : "Testar IMAP"}
                                        {testResults[channel.EmailChannelId]?.inbound === true && <CheckCircle2 size={14} color="var(--accent)" />}
                                        {testResults[channel.EmailChannelId]?.inbound === false && <XCircle size={14} color="#ea4335" />}
                                    </button>
                                    <button 
                                        onClick={() => handleTestOutbound(channel.EmailChannelId)}
                                        disabled={testResults[channel.EmailChannelId]?.loadingOut}
                                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}
                                    >
                                        <Send size={14} /> 
                                        {testResults[channel.EmailChannelId]?.loadingOut ? "A testar..." : "Testar SMTP"}
                                        {testResults[channel.EmailChannelId]?.outbound === true && <CheckCircle2 size={14} color="var(--accent)" />}
                                        {testResults[channel.EmailChannelId]?.outbound === false && <XCircle size={14} color="#ea4335" />}
                                    </button>
                                    <button onClick={() => handleDelete(channel.EmailChannelId)} style={{ padding: "8px", borderRadius: 8, background: "rgba(234, 67, 53, 0.05)", border: "1px solid rgba(234, 67, 53, 0.1)", cursor: "pointer", color: "#ea4335" }}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ padding: "12px 24px", background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                <div style={{ display: "flex", gap: 16 }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Inbox size={12} /> {channel.inbound?.imapHost || "N/A"}</span>
                                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Send size={12} /> {channel.outbound?.smtpHost || "N/A"}</span>
                                </div>
                                <span>Última Sinc: {channel.LastSyncAt ? new Date(channel.LastSyncAt).toLocaleString() : "Nunca"}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
