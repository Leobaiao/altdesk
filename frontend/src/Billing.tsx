import React, { useEffect, useState } from "react";
import { api } from "./lib/api";
import { ArrowLeft, CreditCard, FileText, CheckCircle, AlertTriangle, XCircle, Clock, X, Loader2 } from "lucide-react";

interface Plan {
  PlanId: string;
  Code: string;
  Name: string;
  PriceCents: number;
  Cycle: string;
  AgentsSeatLimit: number;
}

interface Subscription {
  BillingSubscriptionId?: string;
  Status: string;
  PlanCode?: string;
  PlanName?: string;
  ValueCents?: number;
  NextDueDate?: string;
  PaymentMethod?: string;
}

interface Invoice {
  BillingInvoiceId: string;
  Status: string;
  BillingType: string;
  ValueCents: number;
  DueDate: string;
  PaymentDate: string | null;
  InvoiceUrl: string | null;
  BankSlipUrl: string | null;
}

function statusBadge(status: string) {
  const map: Record<string, { color: string; icon: any; label: string }> = {
    active: { color: "#00c853", icon: CheckCircle, label: "Ativo" },
    trialing: { color: "#2196f3", icon: Clock, label: "Trial" },
    pending_activation: { color: "#ff9800", icon: Clock, label: "Pendente" },
    past_due: { color: "#ff5722", icon: AlertTriangle, label: "Vencido" },
    suspended: { color: "#f44336", icon: XCircle, label: "Suspenso" },
    canceled: { color: "#9e9e9e", icon: XCircle, label: "Cancelado" },
    none: { color: "#9e9e9e", icon: CreditCard, label: "Sem assinatura" },
    pending: { color: "#ff9800", icon: Clock, label: "Pendente" },
    received: { color: "#00c853", icon: CheckCircle, label: "Pago" },
    confirmed: { color: "#00c853", icon: CheckCircle, label: "Confirmado" },
    overdue: { color: "#f44336", icon: AlertTriangle, label: "Vencido" },
    refunded: { color: "#9e9e9e", icon: XCircle, label: "Estornado" },
  };
  const info = map[status] || { color: "#9e9e9e", icon: CreditCard, label: status };
  const Icon = info.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: `${info.color}22`, color: info.color
    }}>
      <Icon size={14} /> {info.label}
    </span>
  );
}

function formatCents(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function Billing({ onBack }: { onBack: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Checkout modal state
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutForm, setCheckoutForm] = useState({
    name: "",
    cpfCnpj: "",
    email: "",
    billingType: "PIX" as "PIX" | "BOLETO" | "CREDIT_CARD",
  });

  const loadAll = () => {
    setLoading(true);
    Promise.allSettled([
      api.get("/api/billing/plans").then(r => setPlans(r.data)).catch(() => {}),
      api.get("/api/billing/subscription").then(r => setSubscription(r.data)).catch(() => {}),
      api.get("/api/billing/invoices").then(r => setInvoices(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const openCheckout = (plan: Plan) => {
    setSelectedPlan(plan);
    setCheckoutError("");
    setShowCheckout(true);
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    if (!checkoutForm.name.trim()) { setCheckoutError("Nome é obrigatório."); return; }
    if (!checkoutForm.cpfCnpj.trim()) { setCheckoutError("CPF/CNPJ é obrigatório."); return; }

    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      // 1. Create or get billing customer
      await api.post("/api/billing/customer", {
        name: checkoutForm.name,
        cpfCnpj: checkoutForm.cpfCnpj.replace(/[^\d]/g, ""),
        email: checkoutForm.email || undefined,
      });

      // 2. Create subscription
      await api.post("/api/billing/subscribe", {
        planCode: selectedPlan.Code,
        billingType: checkoutForm.billingType,
      });

      // 3. Reload data and close modal
      setShowCheckout(false);
      setSelectedPlan(null);
      loadAll();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      setCheckoutError(msg || "Erro ao processar assinatura.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={onBack} className="btn" style={{ background: "none", padding: 6 }}><ArrowLeft size={20} /></button>
          <h2 style={{ margin: 0 }}>Faturamento</h2>
        </div>
        <p style={{ color: "var(--text-secondary)" }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} className="btn" style={{ background: "none", padding: 6 }}><ArrowLeft size={20} /></button>
        <h2 style={{ margin: 0 }}>Faturamento</h2>
      </div>

      {/* Current Subscription Card */}
      <div style={{
        background: "var(--bg-secondary)", borderRadius: 12, padding: 24, marginBottom: 24,
        border: "1px solid var(--border)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 8px 0" }}>
              <CreditCard size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Assinatura Atual
            </h3>
            {subscription && subscription.Status !== "none" ? (
              <>
                <p style={{ margin: "4px 0", fontSize: 14, color: "var(--text-secondary)" }}>
                  Plano: <strong>{subscription.PlanName || subscription.PlanCode}</strong>
                </p>
                <p style={{ margin: "4px 0", fontSize: 14, color: "var(--text-secondary)" }}>
                  Valor: <strong>{formatCents(subscription.ValueCents || 0)}</strong>/mês
                </p>
                {subscription.NextDueDate && (
                  <p style={{ margin: "4px 0", fontSize: 14, color: "var(--text-secondary)" }}>
                    Próximo Vencimento: <strong>{new Date(subscription.NextDueDate).toLocaleDateString("pt-BR")}</strong>
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: "4px 0", fontSize: 14, color: "var(--text-secondary)" }}>
                Nenhuma assinatura ativa no momento.
              </p>
            )}
          </div>
          <div>{statusBadge(subscription?.Status || "none")}</div>
        </div>
      </div>

      {/* Plans */}
      <h3 style={{ margin: "0 0 16px 0" }}>Planos Disponíveis</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
        {plans.map(plan => (
          <div key={plan.PlanId} style={{
            background: "var(--bg-secondary)", borderRadius: 12, padding: 20,
            border: subscription?.PlanCode === plan.Code ? "2px solid var(--primary)" : "1px solid var(--border)",
            textAlign: "center"
          }}>
            <h4 style={{ margin: "0 0 8px 0" }}>{plan.Name}</h4>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--primary)", margin: "12px 0" }}>
              {formatCents(plan.PriceCents)}
              <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-secondary)" }}>/mês</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0" }}>
              Até {plan.AgentsSeatLimit} atendentes
            </p>
            {subscription?.PlanCode === plan.Code ? (
              <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600 }}>✓ Plano Atual</span>
            ) : (
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 8, fontSize: 13 }}
                onClick={() => openCheckout(plan)}
              >
                Selecionar
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Invoices */}
      <h3 style={{ margin: "0 0 16px 0" }}>
        <FileText size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
        Histórico de Faturas
      </h3>
      {invoices.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Nenhuma fatura encontrada.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Vencimento</th>
                <th style={{ padding: "10px 12px" }}>Valor</th>
                <th style={{ padding: "10px 12px" }}>Método</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.BillingInvoiceId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    {inv.DueDate ? new Date(inv.DueDate).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{formatCents(inv.ValueCents)}</td>
                  <td style={{ padding: "10px 12px" }}>{inv.BillingType || "-"}</td>
                  <td style={{ padding: "10px 12px" }}>{statusBadge(inv.Status)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {inv.InvoiceUrl && (
                      <a href={inv.InvoiceUrl} target="_blank" rel="noreferrer"
                        style={{ color: "var(--primary)", textDecoration: "none", fontSize: 12, marginRight: 8 }}>
                        Ver Fatura
                      </a>
                    )}
                    {inv.BankSlipUrl && (
                      <a href={inv.BankSlipUrl} target="_blank" rel="noreferrer"
                        style={{ color: "var(--primary)", textDecoration: "none", fontSize: 12 }}>
                        Boleto
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── CHECKOUT MODAL ─────────────────────────────────── */}
      {showCheckout && selectedPlan && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "var(--bg-secondary)", borderRadius: 16, padding: 32,
            width: "100%", maxWidth: 480, border: "1px solid var(--border)",
            position: "relative", animation: "fadeIn 0.2s ease-out"
          }}>
            {/* Close btn */}
            <button
              onClick={() => { setShowCheckout(false); setSelectedPlan(null); }}
              style={{
                position: "absolute", top: 16, right: 16, background: "none",
                border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4
              }}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem" }}>Confirmar Assinatura</h3>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-secondary)", fontSize: 14 }}>
              Plano <strong>{selectedPlan.Name}</strong> — {formatCents(selectedPlan.PriceCents)}/mês
            </p>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Nome / Razão Social *
                </label>
                <input
                  value={checkoutForm.name}
                  onChange={e => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                  placeholder="Empresa Ltda"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1px solid var(--border)", background: "var(--bg-primary)",
                    color: "var(--text-primary)", fontSize: 14, outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  CPF / CNPJ *
                </label>
                <input
                  value={checkoutForm.cpfCnpj}
                  onChange={e => setCheckoutForm({ ...checkoutForm, cpfCnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1px solid var(--border)", background: "var(--bg-primary)",
                    color: "var(--text-primary)", fontSize: 14, outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Email (opcional)
                </label>
                <input
                  value={checkoutForm.email}
                  onChange={e => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                  placeholder="financeiro@empresa.com"
                  type="email"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1px solid var(--border)", background: "var(--bg-primary)",
                    color: "var(--text-primary)", fontSize: 14, outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
                  Forma de Pagamento *
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["PIX", "BOLETO", "CREDIT_CARD"] as const).map(type => {
                    const labels: Record<string, string> = { PIX: "PIX", BOLETO: "Boleto", CREDIT_CARD: "Cartão" };
                    const selected = checkoutForm.billingType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setCheckoutForm({ ...checkoutForm, billingType: type })}
                        style={{
                          flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                          border: selected ? "2px solid var(--primary)" : "1px solid var(--border)",
                          background: selected ? "rgba(0,168,132,0.1)" : "var(--bg-primary)",
                          color: selected ? "var(--primary)" : "var(--text-secondary)",
                          fontSize: 13, fontWeight: 600, transition: "all 0.15s"
                        }}
                      >
                        {labels[type]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Error */}
            {checkoutError && (
              <div style={{
                marginTop: 14, padding: "10px 14px", borderRadius: 10,
                background: "rgba(244,67,54,0.1)", color: "#f44336", fontSize: 13, fontWeight: 500
              }}>
                {checkoutError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setShowCheckout(false); setSelectedPlan(null); }}
                className="btn"
                style={{
                  flex: 1, padding: "12px", borderRadius: 10, fontSize: 14,
                  background: "var(--bg-primary)", border: "1px solid var(--border)",
                  color: "var(--text-secondary)", cursor: "pointer"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="btn btn-primary"
                style={{
                  flex: 2, padding: "12px", borderRadius: 10, fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: checkoutLoading ? 0.7 : 1
                }}
              >
                {checkoutLoading ? (
                  <><Loader2 size={16} className="spin" /> Processando...</>
                ) : (
                  <>✓ Confirmar Assinatura</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
