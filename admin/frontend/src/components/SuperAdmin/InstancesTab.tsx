import React, { useState, useEffect } from "react";
import { Smartphone, Copy, Anchor } from "lucide-react";
import { api } from "../../lib/api";
import { InstanceModal } from "./Modals/InstanceModal";
import { WebhookModal } from "./Modals/WebhookModal";
import { ConnectModal } from "./Modals/ConnectModal";

export function InstancesTab() {
    const [instancesList, setInstancesList] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showInstanceModal, setShowInstanceModal] = useState(false);
    const [showWebhookModal, setShowWebhookModal] = useState(false);
    const [webhookConnectorId, setWebhookConnectorId] = useState("");
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [connectConnectorId, setConnectConnectorId] = useState("");
    const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [reassigningId, setReassigningId] = useState<string | null>(null);

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
            const rawInstances = Array.isArray(rInstances.data) ? rInstances.data : [];
            setTenants(Array.isArray(rTenants.data) ? rTenants.data : []);

            // Auto-sync status para instâncias GTI ativas
            const withStatus = await Promise.all(rawInstances.map(async (inst: any) => {
                if (inst.Provider === "GTI" && inst.IsActive) {
                    try {
                        const statusRes = await api.get(`/api/admin/instances/${inst.ConnectorId}/status`);
                        const state = statusRes.data?.status || "unknown";
                        // Atualizar o ConfigJson local com o status retornado
                        let cfg = {};
                        try { cfg = JSON.parse(inst.ConfigJson || "{}"); } catch {}
                        (cfg as any).connectionStatus = state;
                        return { ...inst, ConfigJson: JSON.stringify(cfg) };
                    } catch {
                        return inst; // Falhou o check, manter original
                    }
                }
                return inst;
            }));

            setInstancesList(withStatus);
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

    // BUG FIX: Corrected route from /reassign to /tenant (matching backend definition)
    const handleReassign = async (connectorId: string, newTenantId: string) => {
        setReassigningId(connectorId);
        try {
            await api.put(`/api/admin/instances/${connectorId}/tenant`, { tenantId: newTenantId });
            loadData();
        } catch (err: any) {
            console.error(err);
            alert("Erro ao reatribuir instância: " + (err.response?.data?.error || err.message));
        } finally {
            setReassigningId(null);
        }
    };

    const handleCheckStatus = async (connectorId: string) => {
        try {
            await api.get(`/api/admin/instances/${connectorId}/status`);
            loadData();
        } catch (err: any) {
            console.error(err);
            alert("Erro ao verificar status: " + (err.response?.data?.error || err.message));
        }
    };

    const handleDisconnect = async (connectorId: string) => {
        if (!confirm("Tem certeza que deseja desconectar esta instância do WhatsApp?")) return;
        try {
            await api.delete(`/api/admin/instances/${connectorId}/disconnect`);
            handleCheckStatus(connectorId);
        } catch (err: any) {
            console.error(err);
            alert("Erro ao desconectar: " + (err.response?.data?.error || err.message));
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Excluir ${selectedInstanceIds.size} instâncias permanentemente?`)) return;
        try {
            await api.post("/api/admin/instances/bulk-delete", { connectorIds: Array.from(selectedInstanceIds) });
            setSelectedInstanceIds(new Set());
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredInstances = instancesList.filter(i => {
        const q = search.toLowerCase();
        return !q || i.ChannelName?.toLowerCase().includes(q) || i.Provider?.toLowerCase().includes(q) || i.TenantName?.toLowerCase().includes(q);
    });

    const toggleSelectAll = () => {
        if (selectedInstanceIds.size === filteredInstances.length) setSelectedInstanceIds(new Set());
        else setSelectedInstanceIds(new Set(filteredInstances.map((i: any) => i.ConnectorId)));
    };

    const toggleSelectOne = (id: string) => {
        const next = new Set(selectedInstanceIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedInstanceIds(next);
    };

    const providerStyle = (provider: string) => {
        const map: Record<string, { bg: string; color: string }> = {
            GTI: { bg: "rgba(0,168,132,0.15)", color: "#00a884" },
            OFFICIAL: { bg: "rgba(66,133,244,0.15)", color: "#4285f4" },
            WEBCHAT: { bg: "rgba(255,152,0,0.15)", color: "#ff9800" },
        };
        return map[provider] || { bg: "rgba(255,255,255,0.08)", color: "#aaa" };
    };

    return (
        <>
            {/* Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", pointerEvents: "none", fontSize: "0.9rem" }}>🔍</span>
                        <input
                            placeholder="Buscar por nome, provider ou empresa..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.9rem", outline: "none", transition: "box-shadow 0.2s" }}
                            onFocus={e => (e.target.style.boxShadow = "0 0 0 2px var(--accent)")}
                            onBlur={e => (e.target.style.boxShadow = "none")}
                        />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        <Smartphone size={15} />
                        {loading ? "Carregando..." : <><b style={{ color: "var(--text-primary)" }}>{filteredInstances.length}</b> instâncias</>}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    {selectedInstanceIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="btn" style={{ background: "rgba(234,67,53,0.12)", color: "var(--danger)", border: "1px solid rgba(234,67,53,0.3)", borderRadius: 10, fontWeight: 600 }}>
                            🗑 Excluir ({selectedInstanceIds.size})
                        </button>
                    )}
                    <button onClick={() => setShowInstanceModal(true)} className="btn btn-primary" style={{ borderRadius: 10 }}>
                        + Nova Instância
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="admin-table-container" style={{ overflowX: "auto", background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-primary)" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-active)", textAlign: "left" }}>
                            <th style={{ padding: "14px 20px" }}>
                                <input type="checkbox" checked={filteredInstances.length > 0 && selectedInstanceIds.size === filteredInstances.length} onChange={toggleSelectAll} style={{ accentColor: "var(--accent)", width: 15, height: 15, cursor: "pointer" }} />
                            </th>
                            {["Nome / Canal", "Provider", "Empresa (Dona)", "Token / Chave", "Status", "Webhook"].map(h => (
                                <th key={h} style={{ padding: "14px 20px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-secondary)", fontWeight: 700, textAlign: h === "Webhook" ? "right" : "left" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInstances.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>{loading ? "⏳ Carregando..." : "Nenhuma instância encontrada."}</td></tr>
                        ) : filteredInstances.map(i => {
                            const config = i.ConfigJson ? JSON.parse(i.ConfigJson) : {};
                            const tokenVal = config.apiKey || config.token || i.WebhookSecret || "-";
                            const isSelected = selectedInstanceIds.has(i.ConnectorId);
                            const isReassigning = reassigningId === i.ConnectorId;
                            const ps = providerStyle(i.Provider);

                            return (
                                <tr key={i.ConnectorId} style={{ borderBottom: "1px solid var(--border)", background: isSelected ? "rgba(0,168,132,0.05)" : "transparent", transition: "background 0.15s" }} className="table-row-hover">
                                    <td style={{ padding: "14px 20px" }}>
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelectOne(i.ConnectorId)} style={{ accentColor: "var(--accent)", width: 15, height: 15, cursor: "pointer" }} />
                                    </td>
                                    <td style={{ padding: "14px 20px" }}>
                                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                            {i.ChannelName}
                                            {config.phoneNumberId && (
                                                <span style={{ fontSize: "0.75rem", background: "var(--bg-primary)", padding: "2px 6px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                                                    📞 {String(config.phoneNumberId).replace("@s.whatsapp.net", "")}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4 }}>ID: {i.ConnectorId.slice(0, 12)}…</div>
                                    </td>
                                    <td style={{ padding: "14px 20px" }}>
                                        <span style={{ background: ps.bg, color: ps.color, padding: "3px 10px", borderRadius: 8, fontSize: "0.73rem", fontWeight: 700, letterSpacing: "0.5px" }}>{i.Provider}</span>
                                    </td>
                                    <td style={{ padding: "14px 20px", minWidth: 190 }}>
                                        <select
                                            value={i.TenantId}
                                            onChange={e => handleReassign(i.ConnectorId, e.target.value)}
                                            disabled={isReassigning}
                                            style={{ padding: "7px 10px", borderRadius: 8, background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)", fontSize: "0.85rem", width: "100%", opacity: isReassigning ? 0.6 : 1, cursor: isReassigning ? "wait" : "pointer", outline: "none" }}
                                        >
                                            {tenants.map((t: any) => <option key={t.TenantId} value={t.TenantId}>{t.Name}</option>)}
                                        </select>
                                        {isReassigning && <div style={{ fontSize: "0.68rem", color: "var(--accent)", marginTop: 3 }}>💾 Salvando...</div>}
                                    </td>
                                    <td style={{ padding: "14px 20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <code style={{ fontSize: "0.78rem", color: "var(--text-secondary)", background: "var(--bg-primary)", padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                                                {tokenVal.length > 16 ? tokenVal.slice(0, 16) + "…" : tokenVal}
                                            </code>
                                            <button onClick={() => navigator.clipboard.writeText(tokenVal)} className="btn btn-ghost" style={{ padding: "4px 8px", height: "auto", borderRadius: 6 }} title="Copiar">
                                                <Copy size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ padding: "14px 20px" }}>
                                        {(() => {
                                            if (!i.IsActive) {
                                                return (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600, color: "var(--danger)" }}>
                                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }} /> Desativado
                                                    </div>
                                                );
                                            }
                                            const status = String(config.connectionStatus || (i.IsActive ? "unknown" : "close")).toLowerCase();
                                            let color = "var(--text-secondary)";
                                            let label = "Desconhecido";
                                            let glow = "none";
                                            if (status === "open" || status === "connected") { color = "var(--accent)"; label = "Online"; glow = "0 0 6px var(--accent)"; }
                                            else if (status === "connecting") { color = "#ff9800"; label = "Aguardando..."; glow = "0 0 6px #ff9800"; }
                                            else if (status === "close" || status === "disconnected") { color = "var(--danger)"; label = "Desconectado"; }
                                            
                                            return (
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600, color }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", boxShadow: glow }} /> {label}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                                        {i.Provider === "GTI" && (
                                            <>
                                                <button onClick={() => handleCheckStatus(i.ConnectorId)} className="btn btn-ghost" style={{ padding: "7px 14px", borderRadius: 8, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: 5, height: "auto", marginRight: 8, color: "var(--text-secondary)", border: "1px solid var(--border)" }} title="Sincronizar Status com a GTI">
                                                    🔄 Sync
                                                </button>
                                                {String(config.connectionStatus).toLowerCase() === "open" || String(config.connectionStatus).toLowerCase() === "connected" ? (
                                                    <button onClick={() => handleDisconnect(i.ConnectorId)} className="btn btn-ghost" style={{ padding: "7px 14px", borderRadius: 8, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: 5, height: "auto", marginRight: 8, color: "var(--danger)", border: "1px solid rgba(234,67,53,0.3)" }}>
                                                        🔌 Desconectar
                                                    </button>
                                                ) : (
                                                    <button onClick={() => { setConnectConnectorId(i.ConnectorId); setShowConnectModal(true); }} className="btn btn-ghost" style={{ padding: "7px 14px", borderRadius: 8, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: 5, height: "auto", marginRight: 8, color: "var(--accent)", border: "1px solid rgba(0,168,132,0.3)" }}>
                                                        🔗 Conectar
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        <button onClick={() => { setWebhookConnectorId(i.ConnectorId); setShowWebhookModal(true); }} className="btn btn-ghost" style={{ padding: "7px 14px", borderRadius: 8, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: 5, height: "auto" }}>
                                            <Anchor size={13} /> Webhook
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
            {showConnectModal && <ConnectModal connectorId={connectConnectorId} onClose={() => setShowConnectModal(false)} />}
        </>
    );
}
