import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { 
    Calendar, Users, Edit3, Clock, Search, 
    AlertTriangle, CheckCircle2, XCircle, ShieldCheck, 
    RefreshCw, Key, ShieldAlert 
} from "lucide-react";
import { useNotification } from "../../contexts/NotificationContext";

interface Subscription {
    TenantId: string;
    Name: string;
    CreatedAt: string;
    AccountStatus: "TRIAL" | "ACTIVE";
    IsActive: boolean;
    ExpiresAt: string;
    AgentsSeatLimit: number;
    PlanCode: string | null;
    BillingStatus: string | null;
    BillingNextDue: string | null;
    PlanName: string | null;
    UserCount: number;
    InstanceCount: number;
}

export function SubscriptionsTab() {
    const [tenants, setTenants] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "TRIAL" | "ACTIVE" | "EXPIRED" | "INACTIVE">("ALL");
    const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    
    // Modal Form State
    const [planCode, setPlanCode] = useState("");
    const [agentsLimit, setAgentsLimit] = useState(5);
    const [accountStatus, setAccountStatus] = useState<"TRIAL" | "ACTIVE">("TRIAL");
    const [subIsActive, setSubIsActive] = useState(true);
    const [expiresAtStr, setExpiresAtStr] = useState("");

    const { notify } = useNotification();

    const loadSubscriptions = async () => {
        setLoading(true);
        try {
            const r = await api.get("/api/admin/tenants");
            setTenants(Array.isArray(r.data) ? r.data : []);
        } catch (err) {
            console.error("Erro ao carregar assinaturas:", err);
            notify("Erro ao carregar assinaturas", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubscriptions();
    }, []);

    const handleOpenEdit = (sub: Subscription) => {
        setSelectedSub(sub);
        setPlanCode(sub.PlanCode || "TRIAL");
        setAgentsLimit(sub.AgentsSeatLimit || 5);
        setAccountStatus(sub.AccountStatus || "TRIAL");
        setSubIsActive(sub.IsActive);
        
        if (sub.ExpiresAt) {
            const date = new Date(sub.ExpiresAt);
            // Formata para YYYY-MM-DD local para o input date
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            setExpiresAtStr(`${year}-${month}-${day}`);
        } else {
            setExpiresAtStr("");
        }
        setShowEditModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSub) return;

        try {
            // Se expiresAtStr estiver preenchido, convertemos para ISO. Senão, nulo.
            let expiresAt: string | null = null;
            if (expiresAtStr) {
                // Definir para o fim do dia (23:59:59) da data selecionada na timezone local do admin
                const localDate = new Date(expiresAtStr + "T23:59:59");
                expiresAt = localDate.toISOString();
            }

            await api.put(`/api/admin/tenants/${selectedSub.TenantId}/subscription`, {
                planCode,
                agentsLimit,
                accountStatus,
                isActive: subIsActive,
                expiresAt
            });

            notify("Assinatura atualizada com sucesso!", "success");
            setShowEditModal(false);
            loadSubscriptions();
        } catch (err: any) {
            console.error(err);
            notify("Erro ao atualizar assinatura: " + (err.response?.data?.error || err.message), "error");
        }
    };

    // Estender expiração de forma rápida
    const extendQuick = (days: number | "unlimited") => {
        const today = new Date();
        if (days === "unlimited") {
            setExpiresAtStr("2099-12-31");
        } else {
            today.setDate(today.getDate() + days);
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            setExpiresAtStr(`${year}-${month}-${day}`);
        }
    };

    const isExpired = (expiresAt: string) => {
        return expiresAt && new Date(expiresAt) < new Date();
    };

    const isExpiringSoon = (expiresAt: string) => {
        if (!expiresAt) return false;
        const exp = new Date(expiresAt);
        const diffTime = exp.getTime() - Date.now();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 3; // Menos de 3 dias para expirar
    };

    const getExpirationStatus = (sub: Subscription) => {
        if (!sub.IsActive) return { label: "Assinatura Inativa", color: "var(--danger)" };
        if (isExpired(sub.ExpiresAt)) return { label: "Expirada", color: "var(--danger)" };
        if (isExpiringSoon(sub.ExpiresAt)) return { label: "Expira em breve", color: "orange" };
        return { label: "Ativa", color: "var(--accent)" };
    };

    const filteredTenants = tenants.filter(t => {
        const matchesSearch = !search || t.Name?.toLowerCase().includes(search.toLowerCase()) || t.PlanCode?.toLowerCase().includes(search.toLowerCase());
        const expired = isExpired(t.ExpiresAt);
        
        let matchesStatus = true;
        if (statusFilter === "TRIAL") matchesStatus = t.AccountStatus === "TRIAL";
        else if (statusFilter === "ACTIVE") matchesStatus = t.AccountStatus === "ACTIVE";
        else if (statusFilter === "EXPIRED") matchesStatus = expired;
        else if (statusFilter === "INACTIVE") matchesStatus = !t.IsActive;

        return matchesSearch && matchesStatus;
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: 600, animation: "fadeIn 0.2s ease-out" }}>
            {/* Header / Filtros */}
            <div style={{
                background: "var(--bg-secondary)",
                borderRadius: 16,
                border: "1px solid var(--border)",
                padding: "20px 24px",
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                alignItems: "center",
                justifyContent: "space-between"
            }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 280 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                        <input
                            placeholder="Buscar empresa ou plano..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px 16px 10px 38px",
                                fontSize: "0.85rem",
                                borderRadius: 10,
                                border: "1px solid var(--border)",
                                background: "var(--bg-primary)",
                                color: "var(--text-primary)",
                                outline: "none",
                                transition: "all 0.2s"
                            }}
                            className="input-search"
                        />
                    </div>
                    <button 
                        onClick={loadSubscriptions}
                        disabled={loading}
                        style={{
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border)",
                            color: "var(--text-secondary)",
                            padding: "10px",
                            borderRadius: 10,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                        title="Atualizar lista"
                    >
                        <RefreshCw size={16} className={loading ? "spin" : ""} />
                    </button>
                </div>

                <div style={{ display: "flex", background: "var(--bg-primary)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", gap: 2 }}>
                    {[
                        { id: "ALL", label: "Todas" },
                        { id: "TRIAL", label: "Teste (Trial)" },
                        { id: "ACTIVE", label: "Ativas (Real)" },
                        { id: "EXPIRED", label: "Expiradas" },
                        { id: "INACTIVE", label: "Inativas" },
                    ].map(s => (
                        <button
                            key={s.id}
                            onClick={() => setStatusFilter(s.id as any)}
                            style={{
                                padding: "6px 14px",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                borderRadius: 8,
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                background: statusFilter === s.id ? "var(--accent)" : "transparent",
                                color: statusFilter === s.id ? "#fff" : "var(--text-secondary)"
                            }}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabela de Assinaturas */}
            <div style={{
                background: "var(--bg-secondary)",
                borderRadius: 16,
                border: "1px solid var(--border)",
                overflow: "hidden"
            }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                        <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", textAlign: "left" }}>
                            <th style={{ padding: "16px 20px", fontWeight: 700 }}>Empresa</th>
                            <th style={{ padding: "16px 20px", fontWeight: 700 }}>Plano</th>
                            <th style={{ padding: "16px 20px", fontWeight: 700 }}>Status Conta</th>
                            <th style={{ padding: "16px 20px", fontWeight: 700 }}>Atendentes</th>
                            <th style={{ padding: "16px 20px", fontWeight: 700 }}>Expiração (Sistema)</th>
                            <th style={{ padding: "16px 20px", fontWeight: 700 }}>Status Sistema</th>
                            <th style={{ padding: "16px 20px", fontWeight: 700, textAlign: "right" }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && filteredTenants.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
                                    Carregando assinaturas...
                                </td>
                            </tr>
                        ) : filteredTenants.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
                                    Nenhuma assinatura encontrada.
                                </td>
                            </tr>
                        ) : (
                            filteredTenants.map(sub => {
                                const expStatus = getExpirationStatus(sub);
                                const expired = isExpired(sub.ExpiresAt);
                                const soon = isExpiringSoon(sub.ExpiresAt);
                                return (
                                    <tr 
                                        key={sub.TenantId} 
                                        style={{ borderBottom: "1px solid var(--border)", transition: "background 0.2s" }}
                                        className="table-row-hover"
                                    >
                                        <td style={{ padding: "16px 20px" }}>
                                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{sub.Name}</div>
                                            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2 }}>
                                                ID: {sub.TenantId}
                                            </div>
                                        </td>
                                        <td style={{ padding: "16px 20px" }}>
                                            <span style={{ 
                                                fontFamily: "monospace", 
                                                fontWeight: 700, 
                                                background: "rgba(255,255,255,0.05)", 
                                                padding: "3px 8px", 
                                                borderRadius: 6,
                                                color: "var(--text-primary)"
                                            }}>
                                                {sub.PlanCode || "TRIAL"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "16px 20px" }}>
                                            <span style={{
                                                fontSize: "0.72rem",
                                                padding: "3px 8px",
                                                borderRadius: 12,
                                                fontWeight: 800,
                                                textTransform: "uppercase",
                                                background: sub.AccountStatus === "ACTIVE" ? "rgba(0,168,132,0.15)" : "rgba(255,165,0,0.15)",
                                                color: sub.AccountStatus === "ACTIVE" ? "var(--accent)" : "orange"
                                            }}>
                                                {sub.AccountStatus === "ACTIVE" ? "Ativa (Real)" : "Teste (Trial)"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "16px 20px", fontWeight: 700 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <Users size={14} style={{ color: "var(--text-secondary)" }} />
                                                <span>{sub.UserCount} / {sub.AgentsSeatLimit}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "16px 20px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <Calendar size={14} style={{ color: "var(--text-secondary)" }} />
                                                <span style={{ 
                                                    fontWeight: 600, 
                                                    color: expired ? "var(--danger)" : soon ? "orange" : "var(--text-primary)" 
                                                }}>
                                                    {sub.ExpiresAt ? new Date(sub.ExpiresAt).toLocaleDateString() : "—"}
                                                </span>
                                                {expired && (
                                                    <span style={{
                                                        fontSize: "0.55rem",
                                                        background: "rgba(234,67,53,0.12)",
                                                        color: "var(--danger)",
                                                        padding: "1px 4px",
                                                        borderRadius: 4,
                                                        fontWeight: 800
                                                    }}>VENCIDO</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: "16px 20px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: expStatus.color }} />
                                                <span style={{ color: expStatus.color }}>{expStatus.label}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                                            <button
                                                onClick={() => handleOpenEdit(sub)}
                                                className="btn btn-ghost"
                                                style={{
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    border: "1px solid var(--border)",
                                                    fontSize: "0.8rem",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6
                                                }}
                                            >
                                                <Edit3 size={13} /> Gerenciar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Edição */}
            {showEditModal && selectedSub && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--bg-secondary)",
                        borderRadius: 20,
                        border: "1px solid var(--border)",
                        width: "100%",
                        maxWidth: 480,
                        boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
                        overflow: "hidden",
                        animation: "fadeIn 0.2s ease-out"
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: "24px 28px",
                            borderBottom: "1px solid var(--border)",
                            background: "var(--bg-primary)",
                            display: "flex",
                            alignItems: "center",
                            gap: 12
                        }}>
                            <div style={{ padding: 8, background: "rgba(0,168,132,0.12)", borderRadius: 10, color: "var(--accent)" }}>
                                <Key size={20} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>Gerenciar Assinatura</h3>
                                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: 2 }}>{selectedSub.Name}</p>
                            </div>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSave} style={{ padding: "28px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                
                                {/* Status da Assinatura (IsActive) */}
                                <div style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    justifyContent: "space-between",
                                    background: "var(--bg-primary)",
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    border: "1px solid var(--border)"
                                }}>
                                    <div>
                                        <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Acesso ao Sistema</div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Bloqueia ou libera o acesso da empresa</div>
                                    </div>
                                    <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, cursor: "pointer" }}>
                                        <input 
                                            type="checkbox" 
                                            checked={subIsActive}
                                            onChange={e => setSubIsActive(e.target.checked)}
                                            style={{ opacity: 0, width: 0, height: 0 }} 
                                        />
                                        <span style={{
                                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                                            background: subIsActive ? "var(--accent)" : "#555",
                                            borderRadius: 24, transition: "0.2s",
                                            display: "flex", alignItems: "center", padding: "0 4px"
                                        }}>
                                            <span style={{
                                                width: 16, height: 16, background: "#fff", borderRadius: "50%",
                                                transition: "0.2s", transform: subIsActive ? "translateX(20px)" : "translateX(0)"
                                            }} />
                                        </span>
                                    </label>
                                </div>

                                {/* Plan Code */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Código do Plano</label>
                                    <input 
                                        type="text" 
                                        value={planCode}
                                        onChange={e => setPlanCode(e.target.value.toUpperCase())}
                                        placeholder="TRIAL, BASIC, PRO..."
                                        style={modalInputStyle}
                                    />
                                </div>

                                {/* Grid de Status da Conta + Limite de Cadeiras */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Tipo de Conta</label>
                                        <select
                                            value={accountStatus}
                                            onChange={e => setAccountStatus(e.target.value as any)}
                                            style={modalInputStyle}
                                        >
                                            <option value="TRIAL">Teste (Trial)</option>
                                            <option value="ACTIVE">Ativo (Real)</option>
                                        </select>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Limite de Agentes</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={agentsLimit}
                                            onChange={e => setAgentsLimit(Number(e.target.value))}
                                            style={modalInputStyle}
                                        />
                                    </div>
                                </div>

                                {/* Expiração da Assinatura */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Validade da Assinatura</label>
                                        {isExpired(selectedSub.ExpiresAt) && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--danger)", fontSize: "0.72rem", fontWeight: 700 }}>
                                                <ShieldAlert size={12} />
                                                <span>Acesso expirado!</span>
                                            </div>
                                        )}
                                    </div>
                                    <input 
                                        type="date"
                                        value={expiresAtStr}
                                        onChange={e => setExpiresAtStr(e.target.value)}
                                        style={modalInputStyle}
                                    />
                                    
                                    {/* Botões rápidos de extensão */}
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                                        <button 
                                            type="button" 
                                            onClick={() => extendQuick(7)}
                                            style={quickBtnStyle}
                                        >
                                            +7 dias
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => extendQuick(14)}
                                            style={quickBtnStyle}
                                        >
                                            +14 dias
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => extendQuick(30)}
                                            style={quickBtnStyle}
                                        >
                                            +30 dias
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => extendQuick("unlimited")}
                                            style={{
                                                ...quickBtnStyle,
                                                background: "rgba(0,168,132,0.1)",
                                                border: "1px solid rgba(0,168,132,0.2)",
                                                color: "var(--accent)"
                                            }}
                                        >
                                            Ilimitado (2099)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer / Ações */}
                            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="btn btn-ghost"
                                    style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: "0.88rem" }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 2, padding: "12px", borderRadius: 12, fontSize: "0.88rem", fontWeight: 700 }}
                                >
                                    Salvar Assinatura
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const modalInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontSize: "0.85rem",
    outline: "none"
};

const quickBtnStyle: React.CSSProperties = {
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    fontSize: "0.72rem",
    padding: "6px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.15s"
};
