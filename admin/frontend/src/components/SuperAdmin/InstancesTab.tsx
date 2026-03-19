import React, { useState, useEffect } from "react";
import { Smartphone, Copy, Anchor } from "lucide-react";
import { api } from "../../lib/api";
import { InstanceModal } from "./Modals/InstanceModal";
import { WebhookModal } from "./Modals/WebhookModal";

export function InstancesTab() {
    const [instancesList, setInstancesList] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showInstanceModal, setShowInstanceModal] = useState(false);
    const [showWebhookModal, setShowWebhookModal] = useState(false);
    const [webhookConnectorId, setWebhookConnectorId] = useState("");
    const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rInstances, rTenants] = await Promise.all([
                api.get("/api/admin/instances"),
                api.get("/api/admin/tenants")
            ]);

            if (Array.isArray(rInstances.data)) {
                setInstancesList(rInstances.data);
            } else {
                console.error("API returned non-array for instances:", rInstances.data);
                setInstancesList([]);
            }

            if (Array.isArray(rTenants.data)) {
                setTenants(rTenants.data);
            } else {
                console.error("API returned non-array for tenants (instances tab):", rTenants.data);
                setTenants([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInstance = async (data: any) => {
        try {
            await api.post("/api/admin/instances", data);
            loadData();
        } catch (err) {
            console.error(err);
            alert("Erro ao criar instância");
        }
    };

    const handleReassign = async (connectorId: string, newTenantId: string) => {
        try {
            await api.put(`/api/admin/instances/${connectorId}/reassign`, { tenantId: newTenantId });
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Excluir ${selectedInstanceIds.size} instâncias?`)) return;
        try {
            await api.post("/api/admin/instances/bulk-delete", { connectorIds: Array.from(selectedInstanceIds) });
            setSelectedInstanceIds(new Set());
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const toggleSelectAll = () => {
        if (selectedInstanceIds.size === instancesList.length) setSelectedInstanceIds(new Set());
        else setSelectedInstanceIds(new Set(instancesList.map(i => i.ConnectorId)));
    };

    const toggleSelectOne = (id: string) => {
        const next = new Set(selectedInstanceIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedInstanceIds(next);
    };

    return (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}>
                    <Smartphone size={18} />
                    {loading ? <span>Carregando...</span> : <span>{instancesList.length} instâncias encontradas</span>}
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                    {selectedInstanceIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="btn"
                            style={{ background: "var(--danger)", color: "white", padding: "10px 18px", borderRadius: 10 }}
                        >
                            Excluir Selecionados ({selectedInstanceIds.size})
                        </button>
                    )}
                    <button onClick={() => setShowInstanceModal(true)} className="btn btn-primary" style={{ borderRadius: 10 }}>
                        + Nova Instância
                    </button>
                </div>
            </div>

            <div style={{ overflowX: "auto", background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-primary)" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-active)", textAlign: "left" }}>
                            <th style={{ padding: "16px 20px" }}>
                                <input
                                    type="checkbox"
                                    checked={instancesList.length > 0 && selectedInstanceIds.size === instancesList.length}
                                    onChange={toggleSelectAll}
                                    style={{ accentColor: "var(--accent)", width: 16, height: 16, cursor: "pointer" }}
                                />
                            </th>
                            <th style={{ padding: "16px 20px" }}>Nome</th>
                            <th style={{ padding: "16px 20px" }}>Número/ID</th>
                            <th style={{ padding: "16px 20px" }}>Provider</th>
                            <th style={{ padding: "16px 20px" }}>Empresa (Dona)</th>
                            <th style={{ padding: "16px 20px" }}>Token/Chave</th>
                            <th style={{ padding: "16px 20px" }}>Status</th>
                            <th style={{ padding: "16px 20px", textAlign: "right" }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {instancesList.map(i => {
                            const config = i.ConfigJson ? JSON.parse(i.ConfigJson) : {};
                            let phone = i.Provider === "GTI" || i.Provider === "WHATSAPP" || i.Provider === "OFFICIAL" ? config.phoneNumberId || "-" : "-";
                            let tokenVal = i.Provider === "GTI" ? config.apiKey || "-" : i.WebhookSecret || "-";
                            const isSelected = selectedInstanceIds.has(i.ConnectorId);

                            return (
                                <tr key={i.ConnectorId} style={{ borderBottom: "1px solid var(--border)", background: isSelected ? "rgba(0, 168, 132, 0.05)" : "transparent", transition: "all 0.2s" }} className="table-row-hover">
                                    <td style={{ padding: "16px 20px" }}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectOne(i.ConnectorId)}
                                            style={{ accentColor: "var(--accent)", width: 16, height: 16, cursor: "pointer" }}
                                        />
                                    </td>
                                    <td style={{ padding: "16px 20px", fontWeight: 500 }}>{i.ChannelName}</td>
                                    <td style={{ padding: "16px 20px", color: "var(--text-secondary)" }}>{phone}</td>
                                    <td style={{ padding: "16px 20px" }}>
                                        <span style={{ background: "var(--bg-primary)", padding: "4px 8px", borderRadius: 6, fontSize: "0.75rem", border: "1px solid var(--border)" }}>{i.Provider}</span>
                                    </td>
                                    <td style={{ padding: "16px 20px" }}>
                                        <select
                                            value={i.TenantId}
                                            onChange={(e) => handleReassign(i.ConnectorId, e.target.value)}
                                            style={{ padding: "8px 12px", borderRadius: 10, background: "var(--bg-primary)", color: "white", border: "1px solid var(--border)", fontSize: "0.85rem", outline: "none", cursor: "pointer" }}
                                        >
                                            {tenants.map(t => (
                                                <option key={t.TenantId} value={t.TenantId}>{t.Name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={{ padding: "16px 20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <code style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{tokenVal.length > 20 ? tokenVal.slice(0, 20) + "..." : tokenVal}</code>
                                            <button onClick={() => { navigator.clipboard.writeText(tokenVal); alert("Copiado!"); }} className="btn btn-ghost" style={{ padding: 4, borderRadius: 6 }} title="Copiar Token"><Copy size={12} /></button>
                                        </div>
                                    </td>
                                    <td style={{ padding: "16px 20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600, color: i.IsActive ? "var(--accent)" : "var(--danger)" }}>
                                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }} />
                                            {i.IsActive ? "Conectado" : "Offline"}
                                        </div>
                                    </td>
                                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                                        <button
                                            onClick={() => { setWebhookConnectorId(i.ConnectorId); setShowWebhookModal(true); }}
                                            className="btn btn-primary"
                                            style={{ padding: "8px 12px", borderRadius: 10, fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                                        >
                                            <Anchor size={14} /> Webhook
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showInstanceModal && <InstanceModal tenants={tenants} onClose={() => setShowInstanceModal(false)} onSubmit={handleCreateInstance} />}
            {showWebhookModal && <WebhookModal connectorId={webhookConnectorId} onClose={() => setShowWebhookModal(false)} />}
        </>
    );
}
