import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { TenantModal } from "./Modals/TenantModal";
import { LimitModal } from "./Modals/LimitModal";
import { TenantDetailsModal } from "./Modals/TenantDetailsModal";

interface TenantsTabProps {
    onShowModalChange: (show: boolean) => void;
}

export function TenantsTab({ onShowModalChange }: TenantsTabProps) {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [editTenant, setEditTenant] = useState<any>(null);
    const [selectedTenant, setSelectedTenant] = useState<any>(null);

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        setLoading(true);
        try {
            const r = await api.get("/api/admin/tenants");
            if (Array.isArray(r.data)) {
                setTenants(r.data);
            } else {
                console.error("API returned non-array for tenants:", r.data);
                setTenants([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTenant = async (data: any) => {
        try {
            await api.post("/api/admin/tenants", data);
            loadTenants();
        } catch (err) {
            console.error(err);
            alert("Erro ao criar empresa");
        }
    };

    const handleSaveLimit = async (limit: number) => {
        try {
            await api.put(`/api/admin/tenants/${editTenant.TenantId}`, { agentsLimit: limit });
            loadTenants();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar limite");
        }
    };

    const handleDelete = async (tenantId: string) => {
        if (!confirm("Tem certeza que deseja desativar esta empresa?")) return;
        try {
            await api.delete(`/api/admin/tenants/${tenantId}`);
            loadTenants();
        } catch (err) {
            console.error(err);
        }
    };

    const handleReactivateTenant = async (tenantId: string) => {
        try {
            await api.put(`/api/admin/tenants/${tenantId}/reactivate`);
            loadTenants();
        } catch (err) {
            console.error(err);
        }
    };

    // Propagate showModal to parent to show "Nova Empresa" button in header if needed
    // Actually, the button is in the parent. We can either move it here or keep it in parent.
    // The current SuperAdmin has the button in the parent. Let's keep it there for now but we need a way to trigger it.
    // Or just move it here.

    return (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                <h2 style={{ fontSize: "1.5rem", margin: 0 }}>Empresas</h2>
                <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: "12px 20px", borderRadius: 12 }}>
                    + Nova Empresa
                </button>
            </div>

            {loading && <p style={{ color: "var(--text-secondary)" }}>Carregando...</p>}
            <div className="tenant-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                {tenants.map(t => (
                    <div key={t.TenantId} style={{
                        background: "var(--bg-secondary)",
                        padding: 24,
                        borderRadius: 16,
                        border: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        transition: "all 0.2s",
                        cursor: "pointer",
                        position: "relative"
                    }}
                        className="card-hover"
                        onClick={() => setSelectedTenant(t)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, color: "var(--text-primary)" }}>{t.Name}</h3>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                <span style={{ fontSize: "1.2rem" }}>🏢</span>
                                <span style={{
                                    fontSize: "0.65rem",
                                    color: "var(--text-secondary)",
                                    background: "var(--bg-primary)",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    border: "1px solid var(--border)"
                                }}>ID: {t.TenantId.slice(0, 8)}...</span>
                            </div>
                        </div>

                        <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Usuários: <b>{t.UserCount}</b></span>
                                <span>Instâncias: <b>{t.InstanceCount || 0}</b></span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span>Limite Agentes: <b>{t.AgentsSeatLimit}</b></span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditTenant(t); setShowLimitModal(true); }}
                                    className="btn btn-ghost"
                                    style={{ padding: "4px 10px", borderRadius: 8, fontSize: "0.75rem" }}
                                >
                                    ✎ Editar
                                </button>
                            </div>
                            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>Expira: <b style={{ color: "var(--text-primary)" }}>{new Date(t.ExpiresAt).toLocaleDateString()}</b></span>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        color: t.IsActive ? "var(--accent)" : "var(--danger)"
                                    }}>
                                        {t.IsActive ? "● ATIVO" : "● INATIVO"}
                                    </span>
                                    {t.IsActive ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(t.TenantId); }}
                                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem" }}
                                            title="Desativar"
                                        >
                                            🗑️
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleReactivateTenant(t.TenantId); }}
                                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem" }}
                                            title="Reativar"
                                        >
                                            🔄
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && <TenantModal onClose={() => setShowModal(false)} onSubmit={handleCreateTenant} />}
            {showLimitModal && editTenant && <LimitModal tenant={editTenant} onClose={() => setShowLimitModal(false)} onSubmit={handleSaveLimit} />}
            {selectedTenant && <TenantDetailsModal tenant={selectedTenant} onClose={() => setSelectedTenant(null)} />}
        </>
    );
}
