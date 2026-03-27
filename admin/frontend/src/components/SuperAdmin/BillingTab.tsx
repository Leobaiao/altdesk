import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { CreditCard, Plus, Edit2, CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Save, X } from "lucide-react";

interface Plan {
    PlanId: string;
    Code: string;
    Name: string;
    PriceCents: number;
    Cycle: string;
    AgentsSeatLimit: number;
    IsActive: boolean;
}

interface BillingSub {
    BillingSubscriptionId: string;
    TenantName: string;
    PlanName: string;
    PlanCode: string;
    Status: string;
    ValueCents: number;
    NextDueDate: string | null;
    PaymentMethod: string | null;
    CreatedAt: string;
}

interface BillingInv {
    BillingInvoiceId: string;
    TenantName: string;
    Status: string;
    ValueCents: number;
    DueDate: string | null;
    PaymentDate: string | null;
    BillingType: string | null;
    InvoiceUrl: string | null;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
    active: { color: "#00c853", label: "Ativo" },
    trialing: { color: "#2196f3", label: "Trial" },
    pending_activation: { color: "#ff9800", label: "Pendente" },
    past_due: { color: "#ff5722", label: "Vencido" },
    suspended: { color: "#f44336", label: "Suspenso" },
    canceled: { color: "#9e9e9e", label: "Cancelado" },
    pending: { color: "#ff9800", label: "Pendente" },
    received: { color: "#00c853", label: "Pago" },
    confirmed: { color: "#00c853", label: "Confirmado" },
    overdue: { color: "#f44336", label: "Vencido" },
    refunded: { color: "#9e9e9e", label: "Estornado" },
};

function statusBadge(status: string) {
    const info = STATUS_MAP[status] || { color: "#9e9e9e", label: status };
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: `${info.color}22`, color: info.color
        }}>
            {info.label}
        </span>
    );
}

function formatCents(cents: number) {
    return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

type SubTab = "plans" | "subscriptions" | "invoices";

export function BillingTab() {
    const [subTab, setSubTab] = useState<SubTab>("plans");
    const [plans, setPlans] = useState<Plan[]>([]);
    const [subscriptions, setSubscriptions] = useState<BillingSub[]>([]);
    const [invoices, setInvoices] = useState<BillingInv[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit / New plan modal
    const [editPlan, setEditPlan] = useState<Partial<Plan> | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            const [p, s, i] = await Promise.all([
                api.get("/api/admin/billing/plans"),
                api.get("/api/admin/billing/subscriptions"),
                api.get("/api/admin/billing/invoices"),
            ]);
            setPlans(p.data);
            setSubscriptions(s.data);
            setInvoices(i.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openNewPlan = () => {
        setEditPlan({ Code: "", Name: "", PriceCents: 0, Cycle: "monthly", AgentsSeatLimit: 3, IsActive: true });
        setSaveError("");
    };

    const openEditPlan = (plan: Plan) => {
        setEditPlan({ ...plan });
        setSaveError("");
    };

    const savePlan = async () => {
        if (!editPlan) return;
        setSaving(true);
        setSaveError("");
        try {
            if (editPlan.PlanId) {
                // Update
                await api.put(`/api/admin/billing/plans/${editPlan.PlanId}`, {
                    name: editPlan.Name,
                    priceCents: editPlan.PriceCents,
                    agentsSeatLimit: editPlan.AgentsSeatLimit,
                    isActive: editPlan.IsActive,
                });
            } else {
                // Create
                await api.post("/api/admin/billing/plans", {
                    code: editPlan.Code,
                    name: editPlan.Name,
                    priceCents: editPlan.PriceCents,
                    cycle: editPlan.Cycle,
                    agentsSeatLimit: editPlan.AgentsSeatLimit,
                });
            }
            setEditPlan(null);
            load();
        } catch (err: any) {
            setSaveError(err.response?.data?.error || err.message || "Erro ao salvar plano.");
        } finally {
            setSaving(false);
        }
    };

    const SUB_TABS: { id: SubTab; label: string }[] = [
        { id: "plans", label: "Planos" },
        { id: "subscriptions", label: "Assinaturas" },
        { id: "invoices", label: "Faturas" },
    ];

    if (loading) return <p style={{ color: "var(--text-secondary)" }}>Carregando faturamento...</p>;

    return (
        <div>
            {/* Sub-tab navigation */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-secondary)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", width: "fit-content" }}>
                {SUB_TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setSubTab(t.id)}
                        style={{
                            padding: "8px 18px", background: subTab === t.id ? "var(--accent)" : "transparent",
                            border: "none", color: subTab === t.id ? "#fff" : "var(--text-secondary)",
                            borderRadius: 8, cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.15s"
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ─── PLANS ──────────────────────────── */}
            {subTab === "plans" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Planos de Assinatura</h3>
                        <button
                            onClick={openNewPlan}
                            style={{
                                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                                background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
                                cursor: "pointer", fontSize: "0.82rem", fontWeight: 600
                            }}
                        >
                            <Plus size={16} /> Novo Plano
                        </button>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                                    <th style={{ padding: "10px 12px" }}>Código</th>
                                    <th style={{ padding: "10px 12px" }}>Nome</th>
                                    <th style={{ padding: "10px 12px" }}>Preço</th>
                                    <th style={{ padding: "10px 12px" }}>Ciclo</th>
                                    <th style={{ padding: "10px 12px" }}>Atendentes</th>
                                    <th style={{ padding: "10px 12px" }}>Status</th>
                                    <th style={{ padding: "10px 12px" }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plans.map(plan => (
                                    <tr key={plan.PlanId} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 600 }}>{plan.Code}</td>
                                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>{plan.Name}</td>
                                        <td style={{ padding: "10px 12px", color: "var(--accent)", fontWeight: 700 }}>{formatCents(plan.PriceCents)}</td>
                                        <td style={{ padding: "10px 12px" }}>{plan.Cycle}</td>
                                        <td style={{ padding: "10px 12px", textAlign: "center" }}>{plan.AgentsSeatLimit}</td>
                                        <td style={{ padding: "10px 12px" }}>
                                            {plan.IsActive ? (
                                                <span style={{ color: "#00c853", fontSize: 12, fontWeight: 600 }}>● Ativo</span>
                                            ) : (
                                                <span style={{ color: "#9e9e9e", fontSize: 12, fontWeight: 600 }}>● Inativo</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "10px 12px" }}>
                                            <button
                                                onClick={() => openEditPlan(plan)}
                                                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 4 }}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── SUBSCRIPTIONS ──────────────────── */}
            {subTab === "subscriptions" && (
                <div>
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem" }}>Assinaturas de Empresas</h3>
                    {subscriptions.length === 0 ? (
                        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Nenhuma assinatura registrada.</p>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                                        <th style={{ padding: "10px 12px" }}>Empresa</th>
                                        <th style={{ padding: "10px 12px" }}>Plano</th>
                                        <th style={{ padding: "10px 12px" }}>Valor</th>
                                        <th style={{ padding: "10px 12px" }}>Pagamento</th>
                                        <th style={{ padding: "10px 12px" }}>Status</th>
                                        <th style={{ padding: "10px 12px" }}>Próx. Vencimento</th>
                                        <th style={{ padding: "10px 12px" }}>Criada em</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subscriptions.map(sub => (
                                        <tr key={sub.BillingSubscriptionId} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{sub.TenantName}</td>
                                            <td style={{ padding: "10px 12px" }}>{sub.PlanName}</td>
                                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{formatCents(sub.ValueCents)}</td>
                                            <td style={{ padding: "10px 12px" }}>{sub.PaymentMethod || "-"}</td>
                                            <td style={{ padding: "10px 12px" }}>{statusBadge(sub.Status)}</td>
                                            <td style={{ padding: "10px 12px" }}>
                                                {sub.NextDueDate ? new Date(sub.NextDueDate).toLocaleDateString("pt-BR") : "-"}
                                            </td>
                                            <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                                                {new Date(sub.CreatedAt).toLocaleDateString("pt-BR")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ─── INVOICES ──────────────────────── */}
            {subTab === "invoices" && (
                <div>
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem" }}>Faturas</h3>
                    {invoices.length === 0 ? (
                        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Nenhuma fatura registrada.</p>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                                        <th style={{ padding: "10px 12px" }}>Empresa</th>
                                        <th style={{ padding: "10px 12px" }}>Valor</th>
                                        <th style={{ padding: "10px 12px" }}>Método</th>
                                        <th style={{ padding: "10px 12px" }}>Vencimento</th>
                                        <th style={{ padding: "10px 12px" }}>Pagamento</th>
                                        <th style={{ padding: "10px 12px" }}>Status</th>
                                        <th style={{ padding: "10px 12px" }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(inv => (
                                        <tr key={inv.BillingInvoiceId} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{inv.TenantName}</td>
                                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{formatCents(inv.ValueCents)}</td>
                                            <td style={{ padding: "10px 12px" }}>{inv.BillingType || "-"}</td>
                                            <td style={{ padding: "10px 12px" }}>
                                                {inv.DueDate ? new Date(inv.DueDate).toLocaleDateString("pt-BR") : "-"}
                                            </td>
                                            <td style={{ padding: "10px 12px" }}>
                                                {inv.PaymentDate ? new Date(inv.PaymentDate).toLocaleDateString("pt-BR") : "-"}
                                            </td>
                                            <td style={{ padding: "10px 12px" }}>{statusBadge(inv.Status)}</td>
                                            <td style={{ padding: "10px 12px" }}>
                                                {inv.InvoiceUrl && (
                                                    <a href={inv.InvoiceUrl} target="_blank" rel="noreferrer"
                                                        style={{ color: "var(--accent)", textDecoration: "none", fontSize: 12 }}>
                                                        Ver Fatura
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ─── PLAN EDIT MODAL ────────────────── */}
            {editPlan && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--bg-secondary)", borderRadius: 16, padding: 28,
                        width: "100%", maxWidth: 420, border: "1px solid var(--border)", position: "relative"
                    }}>
                        <button onClick={() => setEditPlan(null)}
                            style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
                            <X size={20} />
                        </button>

                        <h3 style={{ margin: "0 0 18px 0", fontSize: "1.1rem" }}>
                            {editPlan.PlanId ? "Editar Plano" : "Novo Plano"}
                        </h3>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {!editPlan.PlanId && (
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Código *</label>
                                    <input value={editPlan.Code || ""} onChange={e => setEditPlan({ ...editPlan, Code: e.target.value.toUpperCase() })}
                                        placeholder="PRO" style={inputStyle} />
                                </div>
                            )}
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Nome *</label>
                                <input value={editPlan.Name || ""} onChange={e => setEditPlan({ ...editPlan, Name: e.target.value })}
                                    placeholder="Profissional" style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Preço (centavos) *</label>
                                <input type="number" value={editPlan.PriceCents || 0} onChange={e => setEditPlan({ ...editPlan, PriceCents: parseInt(e.target.value) || 0 })}
                                    style={inputStyle} />
                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                    = {formatCents(editPlan.PriceCents || 0)}
                                </span>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Limite de Atendentes</label>
                                <input type="number" value={editPlan.AgentsSeatLimit || 3} onChange={e => setEditPlan({ ...editPlan, AgentsSeatLimit: parseInt(e.target.value) || 1 })}
                                    style={inputStyle} />
                            </div>
                            {!editPlan.PlanId && (
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Ciclo</label>
                                    <select value={editPlan.Cycle || "monthly"} onChange={e => setEditPlan({ ...editPlan, Cycle: e.target.value })} style={inputStyle}>
                                        <option value="monthly">Mensal</option>
                                        <option value="quarterly">Trimestral</option>
                                        <option value="yearly">Anual</option>
                                    </select>
                                </div>
                            )}
                            {editPlan.PlanId && (
                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                                    <input type="checkbox" checked={editPlan.IsActive !== false}
                                        onChange={e => setEditPlan({ ...editPlan, IsActive: e.target.checked })} />
                                    Plano Ativo
                                </label>
                            )}
                        </div>

                        {saveError && (
                            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(244,67,54,0.1)", color: "#f44336", fontSize: 12 }}>
                                {saveError}
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                            <button onClick={() => setEditPlan(null)} style={{
                                flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--border)",
                                background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13
                            }}>
                                Cancelar
                            </button>
                            <button onClick={savePlan} disabled={saving} style={{
                                flex: 2, padding: "10px", borderRadius: 8, border: "none",
                                background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                opacity: saving ? 0.7 : 1
                            }}>
                                {saving ? <><Loader2 size={14} className="spin" /> Salvando...</> : <><Save size={14} /> Salvar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--bg-primary)",
    color: "var(--text-primary)", fontSize: 13, outline: "none"
};
