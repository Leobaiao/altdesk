import React, { useState } from "react";
import { Smartphone, Globe } from "lucide-react";
import { api } from "../../../lib/api";

interface InstanceModalProps {
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    tenants: any[];
}

export function InstanceModal({ onClose, onSubmit, tenants }: InstanceModalProps) {
    const [instName, setInstName] = useState("");
    const [instProvider, setInstProvider] = useState("GTI");
    const [instConfig, setInstConfig] = useState("");
    const [tenantId, setTenantId] = useState(tenants[0]?.TenantId || "");

    // GTI Specific Form State
    const [gtiToken, setGtiToken] = useState("");
    const [gtiInstanceId, setGtiInstanceId] = useState("");
    const [gtiPhoneId, setGtiPhoneId] = useState("");

    const handleFetchGtiInfo = async () => {
        if (!gtiToken) return alert("Insira o token GTI");
        try {
            const r = await api.get(`/api/admin/instances/gti-info?token=${gtiToken}`);
            const data = r.data;
            if (data.instance) {
                setGtiInstanceId(data.instance.id);
                setGtiPhoneId(data.instance.owner || data.instance.number || "");
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao buscar info da GTI. Verifique o token.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return alert("Selecione uma empresa");

        let finalConfig = instConfig;
        if (instProvider === "GTI") {
            finalConfig = JSON.stringify({
                apiKey: gtiToken,
                instanceId: gtiInstanceId,
                phoneNumberId: gtiPhoneId
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
            <div style={{
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
                    <Smartphone size={24} className="text-accent" />
                    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>Nova Instância</h2>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 28 }}>
                    Conecte um novo canal de comunicação ao sistema.
                </p>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Empresa (Dona)</label>
                        <select required value={tenantId} onChange={e => setTenantId(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }}>
                            <option value="">Selecione uma empresa...</option>
                            {tenants.map(t => (
                                <option key={t.TenantId} value={t.TenantId}>{t.Name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Nome do Canal</label>
                        <input required value={instName} onChange={e => setInstName(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }} placeholder="EX: WhatsApp Comercial" />
                    </div>

                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Provedor</label>
                        <select value={instProvider} onChange={e => setInstProvider(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }}>
                            <option value="GTI">GTI (WhatsApp)</option>
                            <option value="WHATSAPP">WhatsApp Business API</option>
                            <option value="OFFICIAL">Official Cloud API</option>
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
                                        style={{ flex: 1, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "white" }}
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
                    ) : (
                        <div className="field">
                            <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Config JSON</label>
                            <textarea
                                required
                                value={instConfig}
                                onChange={e => setInstConfig(e.target.value)}
                                rows={4}
                                style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white", fontFamily: "monospace", fontSize: "0.85rem" }}
                                placeholder='{"apiKey": "xyz", "phoneNumberId": "123"}'
                            />
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 12 }}>
                        <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: "12px 24px", borderRadius: 12 }}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" style={{ padding: "12px 24px", borderRadius: 12 }}>Criar Instância</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
