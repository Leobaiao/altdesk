import React, { useEffect, useState } from "react";
import { X, Check, Mail, MessageSquare, Monitor, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

type Connector = {
    ConnectorId: string;
    Provider: string;
    ChannelName: string;
};

type ChangeConnectorModalProps = {
    conversationId: string;
    onClose: () => void;
    onChanged: () => void;
};

export function ChangeConnectorModal({ conversationId, onClose, onChanged }: ChangeConnectorModalProps) {
    const [currentConnector, setCurrentConnector] = useState<Connector | null>(null);
    const [availableConnectors, setAvailableConnectors] = useState<Connector[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadConnectors();
    }, [conversationId]);

    async function loadConnectors() {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/api/conversations/${conversationId}/connectors`);
            setCurrentConnector(res.data.currentConnector);
            setAvailableConnectors(res.data.availableConnectors || []);
        } catch (err: any) {
            setError(err.response?.data?.error || "Erro ao carregar conexões.");
        } finally {
            setLoading(false);
        }
    }

    async function handleSwitch(connectorId: string) {
        setSaving(true);
        setError(null);
        try {
            await api.post(`/api/conversations/${conversationId}/change-connector`, { connectorId });
            onChanged();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || "Erro ao trocar de canal.");
        } finally {
            setSaving(false);
        }
    }

    function getIcon(provider: string) {
        const p = provider.toUpperCase();
        if (p.includes("EMAIL")) return <Mail size={20} />;
        if (p.includes("GTI") || p.includes("ZAPI") || p.includes("OFFICIAL") || p.includes("WHATSAPP")) {
            return <MessageSquare size={20} />;
        }
        return <Monitor size={20} />;
    }

    function getColor(provider: string) {
        const p = provider.toUpperCase();
        if (p.includes("EMAIL")) return "#ea4335";
        if (p.includes("GTI") || p.includes("ZAPI") || p.includes("OFFICIAL") || p.includes("WHATSAPP")) {
            return "#25d366";
        }
        return "var(--accent)";
    }

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
            <div style={{
                background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)",
                width: 440, maxWidth: "90%", padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                display: "flex", flexDirection: "column", gap: 20
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>Alterar Canal / Provedor</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}>
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div style={{
                        background: "rgba(234, 67, 53, 0.1)", border: "1px solid rgba(234, 67, 53, 0.2)",
                        borderRadius: 10, padding: "10px 14px", color: "#ea4335", fontSize: "0.85rem",
                        display: "flex", alignItems: "center", gap: 10
                    }}>
                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                {loading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "20px 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                        Carregando instâncias disponíveis...
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Conexão Atual</span>
                            {currentConnector ? (
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 12, marginTop: 8,
                                    background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12,
                                    border: "1px solid var(--border)"
                                }}>
                                    <div style={{
                                        width: 38, height: 38, borderRadius: 10,
                                        background: `${getColor(currentConnector.Provider)}1a`,
                                        color: getColor(currentConnector.Provider),
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                    }}>
                                        {getIcon(currentConnector.Provider)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{currentConnector.ChannelName}</div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500 }}>{currentConnector.Provider}</div>
                                    </div>
                                    <span style={{
                                        background: "rgba(0,168,132,0.1)", color: "#00a884", fontWeight: 700,
                                        fontSize: "0.7rem", padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4
                                    }}>
                                        <Check size={12} /> ATIVO
                                    </span>
                                </div>
                            ) : (
                                <div style={{
                                    marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12,
                                    border: "1px dashed var(--border)", fontSize: "0.85rem", color: "var(--text-secondary)", textAlign: "center"
                                }}>
                                    Nenhum canal associado a esta conversa.
                                </div>
                            )}
                        </div>

                        <div>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Alternar para outro Canal</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, maxHeight: 180, overflowY: "auto" }}>
                                {availableConnectors
                                    .filter(c => c.ConnectorId !== currentConnector?.ConnectorId)
                                    .map(conn => (
                                        <div
                                            key={conn.ConnectorId}
                                            onClick={() => !saving && handleSwitch(conn.ConnectorId)}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 12,
                                                background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12,
                                                border: "1px solid var(--border)", cursor: saving ? "not-allowed" : "pointer",
                                                transition: "all 0.2s"
                                            }}
                                            onMouseEnter={e => {
                                                if (!saving) {
                                                    e.currentTarget.style.borderColor = "var(--accent)";
                                                    e.currentTarget.style.background = "var(--bg-hover)";
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!saving) {
                                                    e.currentTarget.style.borderColor = "var(--border)";
                                                    e.currentTarget.style.background = "var(--bg-primary)";
                                                }
                                            }}
                                        >
                                            <div style={{
                                                width: 38, height: 38, borderRadius: 10,
                                                background: `${getColor(conn.Provider)}1a`,
                                                color: getColor(conn.Provider),
                                                display: "flex", alignItems: "center", justifyContent: "center"
                                            }}>
                                                {getIcon(conn.Provider)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{conn.ChannelName}</div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500 }}>{conn.Provider}</div>
                                            </div>
                                        </div>
                                    ))}

                                {availableConnectors.filter(c => c.ConnectorId !== currentConnector?.ConnectorId).length === 0 && (
                                    <div style={{
                                        background: "var(--bg-primary)", padding: "16px", borderRadius: 12,
                                        border: "1px dashed var(--border)", fontSize: "0.85rem", color: "var(--text-secondary)", textAlign: "center"
                                    }}>
                                        Nenhum outro canal ativo disponível para alternar.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button onClick={onClose} className="btn btn-ghost" style={{ padding: "10px 20px" }}>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
