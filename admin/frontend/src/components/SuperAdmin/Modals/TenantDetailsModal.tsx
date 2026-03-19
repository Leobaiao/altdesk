import React, { useEffect, useState } from "react";
import { Globe, Smartphone } from "lucide-react";
import { api } from "../../../lib/api";

interface TenantDetailsModalProps {
    tenant: any;
    onClose: () => void;
}

export function TenantDetailsModal({ tenant, onClose }: TenantDetailsModalProps) {
    const [instances, setInstances] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        api.get(`/api/admin/tenants/${tenant.TenantId}/instances`)
            .then(res => setInstances(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [tenant.TenantId]);

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
                width: "100%", maxWidth: 600,
                padding: 32,
                borderRadius: 24,
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Globe size={24} className="text-accent" />
                        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>{tenant.Name}</h2>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8, borderRadius: 12 }}>✕</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                    <div style={{ background: "var(--bg-primary)", padding: 20, borderRadius: 16, border: "1px solid var(--border)" }}>
                        <label style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Informações Gerais</label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "0.9rem" }}>
                            <div>Status: <b style={{ color: tenant.IsActive ? "var(--accent)" : "var(--danger)" }}>{tenant.IsActive ? "ATIVO" : "INATIVO"}</b></div>
                            <div>Criado em: <b>{new Date(tenant.CreatedAt).toLocaleDateString()}</b></div>
                            <div>Expira em: <b>{new Date(tenant.ExpiresAt).toLocaleDateString()}</b></div>
                        </div>
                    </div>
                    <div style={{ background: "var(--bg-primary)", padding: 20, borderRadius: 16, border: "1px solid var(--border)" }}>
                        <label style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Estatísticas</label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "0.9rem" }}>
                            <div>Usuários: <b>{tenant.UserCount}</b></div>
                            <div>Instâncias: <b>{tenant.InstanceCount || 0}</b></div>
                            <div>Limite Cadeiras: <b>{tenant.AgentsSeatLimit}</b></div>
                        </div>
                    </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <Smartphone size={18} className="text-secondary" />
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Instâncias da Empresa</h3>
                    </div>

                    {loading ? <p style={{ color: "var(--text-secondary)" }}>Carregando...</p> : (
                        <div style={{ display: "grid", gap: 12 }}>
                            {instances.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic" }}>Nenhuma instância vinculada.</p>}
                            {instances.map(i => (
                                <div key={i.ConnectorId} style={{
                                    background: "var(--bg-primary)",
                                    padding: 16,
                                    borderRadius: 16,
                                    border: "1px solid var(--border)",
                                    borderLeft: `4px solid ${i.IsActive ? 'var(--accent)' : 'var(--danger)'}`,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{i.ChannelName || i.ConnectorId}</div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 4 }}>Provider: {i.Provider}</div>
                                    </div>
                                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: i.IsActive ? "var(--accent)" : "var(--danger)" }}>
                                        {i.IsActive ? "ON" : "OFF"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={onClose} className="btn btn-primary" style={{ padding: "12px 32px", borderRadius: 12 }}>Fechar Detalhes</button>
                </div>
            </div>
        </div>
    );
}
