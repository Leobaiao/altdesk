import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { TenantModal } from "./Modals/TenantModal";
import { LimitModal } from "./Modals/LimitModal";
import { Globe, Smartphone, User, ArrowLeft, MoreVertical, ShieldCheck, Mail, Calendar, Hash } from "lucide-react";

interface TenantsTabProps {
    onShowModalChange: (show: boolean) => void;
}

export function TenantsTab({ onShowModalChange }: TenantsTabProps) {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [editTenant, setEditTenant] = useState<any>(null);
    const [selectedTenant, setSelectedTenant] = useState<any>(null);
    const [search, setSearch] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [instances, setInstances] = useState<any[]>([]);
    const [instancesLoading, setInstancesLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<"ALL" | "TRIAL" | "ACTIVE">("ALL");

    useEffect(() => {
        loadTenants();
    }, []);

    useEffect(() => {
        if (selectedTenant) {
            loadInstances(selectedTenant.TenantId);
        }
    }, [selectedTenant]);

    const loadTenants = async () => {
        setLoading(true);
        try {
            const r = await api.get("/api/admin/tenants");
            const data = Array.isArray(r.data) ? r.data : [];
            setTenants(data);
            // Se não houver nenhum selecionado e houver empresas, seleciona a primeira (opcional, mas pro sidebar é bom)
            // if (data.length > 0 && !selectedTenant) setSelectedTenant(data[0]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadInstances = async (tenantId: string) => {
        setInstancesLoading(true);
        try {
            const res = await api.get(`/api/admin/tenants/${tenantId}/instances`);
            setInstances(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setInstancesLoading(false);
        }
    };

    const handleCreateTenant = async (data: any) => {
        try {
            await api.post("/api/admin/tenants", data);
            loadTenants();
            setShowCreateModal(false);
        } catch (err: any) {
            alert("Erro ao criar empresa: " + (err.response?.data?.error || err.message));
        }
    };

    const handleSaveLimit = async (limit: number) => {
        try {
            await api.put(`/api/admin/tenants/${editTenant.TenantId}`, { agentsLimit: limit });
            loadTenants();
            if (selectedTenant?.TenantId === editTenant.TenantId) {
                setSelectedTenant({ ...selectedTenant, AgentsSeatLimit: limit });
            }
            setShowLimitModal(false);
        } catch (err) {
            alert("Erro ao salvar limite");
        }
    };

    const handleDelete = async (tenantId: string) => {
        if (!confirm("Deseja mover esta empresa para a LIXEIRA? Ela será desativada e ocultada da lista principal.")) return;
        try {
            await api.delete(`/api/admin/tenants/${tenantId}`);
            loadTenants();
            setSelectedTenant(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSetStatus = async (tenantId: string, active: boolean) => {
        const action = active ? "reativar" : "inativar";
        if (!confirm(`Tem certeza que deseja ${action} esta empresa?`)) return;
        try {
            await api.put(`/api/admin/tenants/${tenantId}/status`, { isActive: active });
            loadTenants();
            if (selectedTenant?.TenantId === tenantId) {
                setSelectedTenant({ ...selectedTenant, IsActive: active });
            }
        } catch (err) {
            console.error(err);
        }
    };


    const filteredTenants = tenants.filter(t => {
        const matchesSearch = !search || t.Name?.toLowerCase().includes(search.toLowerCase());
        const matchesActive = showInactive || t.IsActive;
        const matchesStatus = statusFilter === "ALL" || t.AccountStatus === statusFilter;
        return matchesSearch && matchesActive && matchesStatus;
    });

    const isExpired = (expiresAt: string) => expiresAt && new Date(expiresAt) < new Date();

    return (
        <div className="tenants-layout" style={{ display: "flex", gap: 20, height: "calc(100vh - 280px)", minHeight: 600 }}>
            {/* Sidebar de empresas */}
            <div className="tenants-sidebar" style={{
                width: 320,
                background: "var(--bg-secondary)",
                borderRadius: 16,
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
            }}>
                {/* Busca no topo do sidebar */}
                <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", fontSize: "0.8rem" }}>🔍</span>
                        <input
                            placeholder="Buscar empresa..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: "100%", padding: "8px 12px 8px 32px", fontSize: "0.85rem",
                                borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)",
                                color: "var(--text-primary)", outline: "none"
                            }}
                        />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "var(--text-secondary)", cursor: "pointer" }}>
                            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                            Mostrar empresas inativas
                        </label>
                        <div style={{ display: "flex", background: "var(--bg-primary)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", gap: 2 }}>
                            {["ALL", "TRIAL", "ACTIVE"].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s as any)}
                                    style={{
                                        flex: 1, padding: "4px 0", fontSize: "0.72rem", fontWeight: 700, borderRadius: 8,
                                        border: "none", cursor: "pointer", transition: "all 0.2s",
                                        background: statusFilter === s ? "var(--accent)" : "transparent",
                                        color: statusFilter === s ? "#fff" : "var(--text-secondary)"
                                    }}
                                >
                                    {s === "ALL" ? "TODAS" : s === "TRIAL" ? "TESTE" : "REAL"}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary"
                        style={{ width: "100%", marginTop: 12, borderRadius: 10, fontSize: "0.85rem", padding: "10px" }}
                    >
                        + Nova Empresa
                    </button>
                </div>

                {/* Lista de empresas */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                    {loading && tenants.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)" }}>Carregando...</div>
                    ) : filteredTenants.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)" }}>Nenhuma empresa.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {filteredTenants.map(t => {
                                const activeItem = selectedTenant?.TenantId === t.TenantId;
                                const expired = isExpired(t.ExpiresAt);
                                return (
                                    <div
                                        key={t.TenantId}
                                        onClick={() => setSelectedTenant(t)}
                                        style={{
                                            padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                                            background: activeItem ? "rgba(0,168,132,0.12)" : "transparent",
                                            border: activeItem ? "1px solid var(--accent)" : "1px solid transparent",
                                            transition: "all 0.15s",
                                            display: "flex", justifyContent: "space-between", alignItems: "center"
                                        }}
                                        className={!activeItem ? "table-row-hover" : ""}
                                    >
                                        <div style={{ overflow: "hidden", flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 600, color: activeItem ? "var(--accent)" : "var(--text-primary)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                                                    {t.Name}
                                                </div>
                                                {t.AccountStatus === 'TRIAL' && (
                                                    <span style={{ fontSize: "0.55rem", background: "rgba(255,165,0,0.15)", color: "orange", padding: "1px 4px", borderRadius: 4, fontWeight: 800 }}>TRIAL</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 2 }}>{t.UserCount} usuários • {t.InstanceCount || 0} inst.</div>
                                        </div>
                                        {!t.IsActive ? <span style={{ color: "var(--danger)", fontSize: "0.6rem" }}>●</span> : expired ? <span style={{ color: "orange", fontSize: "0.6rem" }}>⚠</span> : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Area de Detalhes (Nova Página / Panel Central) */}
            <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {!selectedTenant ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", gap: 16 }}>
                        <div style={{ padding: 24, background: "var(--bg-primary)", borderRadius: "50%", border: "1px solid var(--border)" }}>
                            <Globe size={48} opacity={0.3} />
                        </div>
                        <p style={{ fontSize: "1rem" }}>Selecione uma empresa para visualizar os detalhes</p>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease-out" }}>
                        {/* Detail Header */}
                        <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", background: "var(--bg-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                                    {selectedTenant.Name}
                                    <span style={{ fontSize: "0.65rem", padding: "3px 8px", borderRadius: 12, background: selectedTenant.IsActive ? "rgba(0,168,132,0.15)" : "rgba(234,67,53,0.15)", color: selectedTenant.IsActive ? "var(--accent)" : "var(--danger)", textTransform: "uppercase", fontWeight: 700 }}>
                                        {selectedTenant.IsActive ? "Ativo" : "Inativo"}
                                    </span>
                                    {selectedTenant.AccountStatus === 'TRIAL' && (
                                        <span style={{ fontSize: "0.65rem", padding: "3px 8px", borderRadius: 12, background: "rgba(255,165,0,0.15)", color: "orange", textTransform: "uppercase", fontWeight: 700 }}>
                                            Trial (Onboarding)
                                        </span>
                                    )}
                                </h2>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4 }}>ID Global: {selectedTenant.TenantId}</div>
                            </div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <button
                                    onClick={() => { setEditTenant(selectedTenant); setShowLimitModal(true); }}
                                    className="btn btn-ghost"
                                    style={{ padding: "8px 16px", borderRadius: 10, fontSize: "0.85rem", border: "1px solid var(--border)" }}
                                >
                                    ✎ Ajustar Limites
                                </button>
                                {selectedTenant.IsActive ? (
                                    <button
                                        onClick={() => handleSetStatus(selectedTenant.TenantId, false)}
                                        className="btn btn-ghost"
                                        style={{ padding: "8px 16px", borderRadius: 10, fontSize: "0.85rem", border: "1px solid var(--border)", color: "#999" }}
                                        title="Inativar Empresa"
                                    >
                                        ⏸️ Inativar
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSetStatus(selectedTenant.TenantId, true)}
                                        className="btn btn-ghost"
                                        style={{ padding: "8px 16px", borderRadius: 10, fontSize: "0.85rem", border: "1px solid var(--border)", color: "#00a884" }}
                                        title="Reativar Empresa"
                                    >
                                        ✅ Reativar
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(selectedTenant.TenantId)}
                                    className="btn btn-ghost"
                                    style={{ padding: "8px 16px", borderRadius: 10, fontSize: "0.85rem", border: "1px solid var(--border)", color: "var(--danger)" }}
                                    title="Mover para Lixeira"
                                >
                                    🗑️ Excluir
                                </button>
                            </div>
                        </div>

                        {/* Detail Content */}
                        <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
                            {/* Stats Grid */}
                            <div className="admin-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
                                <div style={{ background: "var(--bg-primary)", padding: 20, borderRadius: 20, border: "1px solid var(--border)", textAlign: "center", position: "relative" }}>
                                    <div style={{ position: "absolute", right: 12, top: 12, color: "var(--accent)", opacity: 0.2 }}><User size={24} /></div>
                                    <div style={{ fontSize: "2rem", fontWeight: 800 }}>{selectedTenant.UserCount}</div>
                                    <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 700, marginTop: 4 }}>Usuários Ativos</div>
                                </div>
                                <div style={{ background: "var(--bg-primary)", padding: 20, borderRadius: 20, border: "1px solid var(--border)", textAlign: "center", position: "relative" }}>
                                    <div style={{ position: "absolute", right: 12, top: 12, color: "var(--secondary)", opacity: 0.2 }}><Smartphone size={24} /></div>
                                    <div style={{ fontSize: "2rem", fontWeight: 800 }}>{selectedTenant.InstanceCount || 0}</div>
                                    <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 700, marginTop: 4 }}>Instâncias (Canais)</div>
                                </div>
                                <div style={{ background: "var(--bg-primary)", padding: 20, borderRadius: 20, border: "1px solid var(--border)", textAlign: "center", position: "relative" }}>
                                    <div style={{ position: "absolute", right: 12, top: 12, color: "orange", opacity: 0.2 }}><ShieldCheck size={24} /></div>
                                    <div style={{ fontSize: "2rem", fontWeight: 800 }}>{selectedTenant.AgentsSeatLimit}</div>
                                    <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 700, marginTop: 4 }}>Limite de Agentes</div>
                                </div>
                            </div>

                            <div className="tenants-detail-grid" style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 32 }}>
                                {/* Info Table */}
                                <div>
                                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                        <Globe size={16} /> Dados da Assinatura
                                    </h3>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {[
                                            { label: "Data de Início", value: new Date(selectedTenant.CreatedAt).toLocaleDateString(), icon: <Calendar size={14} /> },
                                            { label: "Expiração (Sistema)", value: new Date(selectedTenant.ExpiresAt).toLocaleDateString(), icon: <Calendar size={14} />, color: isExpired(selectedTenant.ExpiresAt) ? "var(--danger)" : "var(--text-primary)" },
                                            { 
                                                label: "Plano Asaas", 
                                                value: selectedTenant.PlanName || "Nenhum Plano Ativo", 
                                                icon: <ShieldCheck size={14} />,
                                                color: selectedTenant.PlanName ? "var(--accent)" : "var(--text-secondary)"
                                            },
                                            { 
                                                label: "Status Financeiro", 
                                                value: selectedTenant.BillingStatus ? selectedTenant.BillingStatus.toUpperCase() : "AGUARDANDO", 
                                                icon: <Hash size={14} />,
                                                color: selectedTenant.BillingStatus === 'active' ? "var(--accent)" : (selectedTenant.BillingStatus === 'past_due' ? "var(--danger)" : "var(--text-secondary)")
                                            },
                                            { 
                                                label: "Próximo Vencimento", 
                                                value: selectedTenant.BillingNextDue ? new Date(selectedTenant.BillingNextDue).toLocaleDateString() : "—", 
                                                icon: <Calendar size={14} /> 
                                            },
                                        ].map(item => (
                                            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)" }}>
                                                <div style={{ color: "var(--text-secondary)" }}>{item.icon}</div>
                                                <div>
                                                    <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 700 }}>{item.label}</div>
                                                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: item.color || "var(--text-primary)" }}>{item.value}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Instances List */}
                                <div>
                                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                        <Smartphone size={16} /> Canais Ativos
                                    </h3>
                                    {instancesLoading ? (
                                        <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>Carregando canais...</div>
                                    ) : instances.length === 0 ? (
                                        <div style={{ padding: 32, textAlign: "center", background: "var(--bg-primary)", borderRadius: 16, border: "1px dashed var(--border)", color: "var(--text-secondary)" }}>
                                            Nenhuma instância vinculada a esta empresa.
                                        </div>
                                    ) : (
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                            {instances.map(inst => (
                                                <div key={inst.ConnectorId} style={{ padding: 16, background: "var(--bg-primary)", borderRadius: 16, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: inst.IsActive ? "rgba(0,168,132,0.1)" : "rgba(234,67,53,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: inst.IsActive ? "var(--accent)" : "var(--danger)" }}>
                                                        <Smartphone size={18} />
                                                    </div>
                                                    <div style={{ overflow: "hidden" }}>
                                                        <div style={{ fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{inst.ChannelName || "Sem Nome"}</div>
                                                        <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Provider: {inst.Provider}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showCreateModal && <TenantModal onClose={() => setShowCreateModal(false)} onSubmit={handleCreateTenant} />}
            {showLimitModal && editTenant && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <LimitModal tenant={editTenant} onClose={() => setShowLimitModal(false)} onSubmit={handleSaveLimit} />
                </div>
            )}
        </div>
    );
}

// Pequeno mock de LimitModal inline ou importado (mantivemos o import mas por seguranca se o original quebrasse no sidebar)
// Mas o original deve funcionar se referenciado corretamente.
