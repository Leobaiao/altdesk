import React, { useEffect, useState, useRef, useCallback } from "react";
import { api } from "./lib/api";
import { ArrowLeft, CreditCard, FileText, CheckCircle, AlertTriangle, XCircle, Clock, X, Loader2, Trash2, Copy, ExternalLink } from "lucide-react";
import { PageHeader } from "./components/PageHeader";
import { useChat } from "./contexts/ChatContext";

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
  AccountStatus?: string;
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

interface PixQrCodeData {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

interface CheckoutResult {
  subscription: any;
  firstPayment?: {
    id: string;
    status: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    billingType: string;
    value: number;
  } | null;
  pixQrCode?: PixQrCodeData | null;
}

function statusBadge(status: string) {
  const map: Record<string, { color: string; icon: any; label: string }> = {
    active: { color: "#00c853", icon: CheckCircle, label: "Ativo" },
    trialing: { color: "#2196f3", icon: Clock, label: "Avaliação" },
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
  const { showConfirm, showToast } = useChat();

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

  // Pix QR Code modal state
  const [pixModal, setPixModal] = useState<{
    paymentId: string;
    qrCode: PixQrCodeData;
    status: string;
  } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Trial cleanup state
  const [cleaning, setCleaning] = useState(false);
  const [cleanupFeedback, setCleanupFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAll = () => {
    setLoading(true);
    Promise.allSettled([
      api.get("/api/billing/plans").then(r => setPlans(r.data)).catch(() => {}),
      api.get("/api/billing/subscription").then(r => setSubscription(r.data)).catch(() => {}),
      api.get("/api/billing/invoices").then(r => setInvoices(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const startPixPolling = useCallback((paymentId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/billing/payment/${paymentId}/status`);
        const status = res.data.status;

        if (status === "RECEIVED" || status === "CONFIRMED" || status === "RECEIVED_IN_CASH") {
          // Payment confirmed!
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPixModal(prev => prev ? { ...prev, status: "CONFIRMED" } : null);
          showToast("Pagamento Pix confirmado! ✅", "success");
          
          // Reload data after a short delay
          setTimeout(() => {
            loadAll();
            setPixModal(null);
          }, 3000);
        }
      } catch (err) {
        // Ignore polling errors silently
      }
    }, 5000);
  }, [showToast]);

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

      // 2. Create subscription (returns rich result with payment info)
      const res = await api.post("/api/billing/subscribe", {
        planCode: selectedPlan.Code,
        billingType: checkoutForm.billingType,
      });

      const result: CheckoutResult = res.data;

      // 3. Close checkout modal
      setShowCheckout(false);
      setSelectedPlan(null);

      // 4. Handle based on billing type
      if (checkoutForm.billingType === "PIX" && result.pixQrCode && result.firstPayment) {
        // Show Pix QR Code modal and start polling
        setPixModal({
          paymentId: result.firstPayment.id,
          qrCode: result.pixQrCode,
          status: "PENDING",
        });
        startPixPolling(result.firstPayment.id);

      } else if (result.firstPayment?.invoiceUrl) {
        // Boleto or Credit Card: redirect to Asaas invoice page
        window.open(result.firstPayment.invoiceUrl, "_blank");
        showToast("Redirecionando para a página de pagamento...", "success");
        loadAll();

      } else {
        // Fallback: just reload data
        showToast("Assinatura criada! Verifique as faturas.", "success");
        loadAll();
      }

    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      setCheckoutError(msg || "Erro ao processar assinatura.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCopyPixCode = (payload: string) => {
    navigator.clipboard.writeText(payload);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2000);
  };

  const handleClosePixModal = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setPixModal(null);
    loadAll();
  };

  const handleCleanup = async () => {
    showConfirm({
      title: "Limpar Dados de Teste",
      description: "Atenção! Isso apagará permanentemente todos os tickets, conversas e contatos de teste. Deseja continuar?",
      confirmLabel: "Limpar Dados",
      cancelLabel: "Cancelar",
      isDanger: true,
      onConfirm: async () => {
        setCleaning(true);
        setCleanupFeedback(null);
        try {
            await api.post("/api/settings/tenant/cleanup");
            setCleanupFeedback({ type: 'success', text: "Dados de teste removidos com sucesso!" });
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (err: any) {
            setCleanupFeedback({
                type: 'error',
                text: err.response?.data?.error || "Falha ao limpar dados de teste."
            });
        } finally {
            setCleaning(false);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="settings-page" style={{ height: "100%", overflowY: "auto" }}>
        <PageHeader 
            title="Faturamento" 
            icon={CreditCard} 
            onBack={onBack} 
            contextKey="billing.index"
            helpText={
                <div>
                    <p>Gerencie o plano da sua empresa, visualize faturas e configure métodos de pagamento.</p>
                    <ul style={{ marginTop: 12, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                        <li><strong>Plano Atual:</strong> Veja os recursos disponíveis no seu nível de assinatura.</li>
                        <li><strong>Histórico:</strong> Acesse faturas anteriores e comprovantes de pagamento.</li>
                        <li><strong>Cartões:</strong> Adicione ou remova cartões de crédito para renovação automática.</li>
                        <li><strong>Upgrade:</strong> Mude seu plano para aumentar limites de usuários e instâncias.</li>
                    </ul>
                </div>
            }
        />
        <p style={{ color: "var(--text-secondary)" }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="settings-page" style={{ height: "100%", overflowY: "auto" }}>
      {/* Header */}
      <PageHeader 
        title="Faturamento" 
        icon={CreditCard} 
        onBack={onBack} 
        contextKey="billing.index"
        helpText={
            <div>
                <p>Gerencie o plano da sua empresa, visualize faturas e configure métodos de pagamento.</p>
                <ul style={{ marginTop: 12, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                    <li><strong>Plano Atual:</strong> Veja os recursos disponíveis no seu nível de assinatura.</li>
                    <li><strong>Histórico:</strong> Acesse faturas anteriores e comprovantes de pagamento.</li>
                    <li><strong>Cartões:</strong> Adicione ou remova cartões de crédito para renovação automática.</li>
                    <li><strong>Upgrade:</strong> Mude seu plano para aumentar limites de usuários e instâncias.</li>
                </ul>
            </div>
        }
      />

      {/* Trial Warning Banner */}
      {subscription?.AccountStatus === "TRIAL" && (
        <div style={{
          background: "rgba(255, 152, 0, 0.1)", border: "1px solid rgba(255, 152, 0, 0.3)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16
        }}>
          <div style={{ background: "rgba(255, 152, 0, 0.2)", color: "#ff9800", padding: 10, borderRadius: 10 }}>
            <Clock size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#ff9800", fontSize: "0.95rem" }}>Período de Avaliação Ativo</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 12 }}>
              Você está explorando o AltDesk com dados de demonstração. Assine um plano para liberar todas as funcionalidades e começar a usar com seus dados reais.
            </div>
            <button 
                onClick={handleCleanup} 
                disabled={cleaning}
                style={{ padding: "8px 14px", borderRadius: 8, fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(244, 67, 54, 0.1)", color: "#f44336", border: "1px solid rgba(244, 67, 54, 0.2)", cursor: "pointer", fontWeight: 600, transition: "all 0.2s" }}
            >
                {cleaning ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} 
                {cleaning ? "A limpar dados..." : "Limpar Dados de Teste Agora"}
            </button>
            {cleanupFeedback && (
                <div style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    textAlign: "center",
                    background: cleanupFeedback.type === 'success' ? "rgba(0, 168, 132, 0.1)" : "rgba(244, 67, 54, 0.1)",
                    color: cleanupFeedback.type === 'success' ? "var(--accent)" : "#f44336",
                    border: cleanupFeedback.type === 'success' ? "1px solid rgba(0, 168, 132, 0.2)" : "1px solid rgba(244, 67, 54, 0.2)"
                }}>
                    {cleanupFeedback.text}
                </div>
            )}
          </div>
        </div>
      )}

      {/* Overdue Warning Banner (in-page) */}
      {subscription?.Status === "past_due" && (
        <div style={{
          background: "rgba(255, 87, 34, 0.1)", border: "1px solid rgba(255, 87, 34, 0.3)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16
        }}>
          <div style={{ background: "rgba(255, 87, 34, 0.2)", color: "#ff5722", padding: 10, borderRadius: 10 }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#ff5722", fontSize: "0.95rem" }}>Pagamento Pendente</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Há uma fatura vencida. Regularize o pagamento para manter sua assinatura ativa.
            </div>
          </div>
        </div>
      )}

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
                        style={{ color: "var(--primary)", textDecoration: "none", fontSize: 12, marginRight: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ExternalLink size={12} /> Ver Fatura
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

              {/* Payment method info */}
              <div style={{
                padding: "10px 14px", borderRadius: 10, fontSize: 12,
                background: "rgba(0,168,132,0.05)", border: "1px solid rgba(0,168,132,0.15)",
                color: "var(--text-secondary)", lineHeight: 1.5
              }}>
                {checkoutForm.billingType === "PIX" && "Após confirmar, o QR Code Pix será exibido na tela para pagamento imediato."}
                {checkoutForm.billingType === "BOLETO" && "Após confirmar, você será redirecionado para a página do boleto para impressão/pagamento."}
                {checkoutForm.billingType === "CREDIT_CARD" && "Após confirmar, você será redirecionado para a página segura de pagamento para inserir os dados do cartão."}
              </div>

              {/* Data Purge Warning explicitly for Trial users */}
              {subscription?.AccountStatus === "TRIAL" && (
                <div style={{
                  padding: "14px 16px", borderRadius: 12, background: "rgba(234, 67, 53, 0.08)",
                  border: "1px solid rgba(234, 67, 53, 0.2)", marginTop: 8
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--danger)", marginBottom: 6 }}>
                    <AlertTriangle size={16} />
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>AVISO DE LIMPEZA DE DADOS</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    Ao confirmar sua assinatura oficial, todos os <strong>dados de demonstração</strong> (mensagens, contatos fake e tickets de teste) serão <strong>apagados permanentemente</strong> para que você inicie sua conta limpa e pronta para uso real.
                  </p>
                </div>
              )}
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

      {/* ─── PIX QR CODE MODAL ────────────────────────────────── */}
      {pixModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "var(--bg-secondary)", borderRadius: 16, padding: 32,
            width: "100%", maxWidth: 420, border: "1px solid var(--border)",
            position: "relative", animation: "fadeIn 0.2s ease-out",
            textAlign: "center"
          }}>
            {/* Close btn */}
            <button
              onClick={handleClosePixModal}
              style={{
                position: "absolute", top: 16, right: 16, background: "none",
                border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4
              }}
            >
              <X size={20} />
            </button>

            {pixModal.status === "CONFIRMED" ? (
              /* ── Payment Confirmed ── */
              <>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
                  background: "rgba(0, 200, 83, 0.15)", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <CheckCircle size={36} color="#00c853" />
                </div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.3rem", color: "#00c853" }}>
                  Pagamento Confirmado!
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px 0" }}>
                  Seu pagamento Pix foi recebido com sucesso. Sua assinatura será ativada em instantes.
                </p>
                <Loader2 size={20} className="spin" style={{ color: "var(--text-secondary)" }} />
              </>
            ) : (
              /* ── Waiting for Payment ── */
              <>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem" }}>Pagamento via Pix</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 20px 0" }}>
                  Escaneie o QR Code ou copie o código para pagar
                </p>

                {/* QR Code Image */}
                <div style={{
                  background: "#fff", borderRadius: 12, padding: 16,
                  display: "inline-block", marginBottom: 20
                }}>
                  <img
                    src={`data:image/png;base64,${pixModal.qrCode.encodedImage}`}
                    alt="QR Code Pix"
                    style={{ width: 200, height: 200 }}
                  />
                </div>

                {/* Pix Copia e Cola */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    PIX COPIA E COLA
                  </label>
                  <div style={{
                    display: "flex", gap: 8, alignItems: "center",
                    background: "var(--bg-primary)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "8px 12px"
                  }}>
                    <input
                      readOnly
                      value={pixModal.qrCode.payload}
                      style={{
                        flex: 1, border: "none", background: "transparent",
                        color: "var(--text-primary)", fontSize: 12, outline: "none",
                        fontFamily: "monospace"
                      }}
                    />
                    <button
                      onClick={() => handleCopyPixCode(pixModal.qrCode.payload)}
                      style={{
                        background: pixCopied ? "rgba(0,200,83,0.15)" : "rgba(0,168,132,0.1)",
                        border: "none", borderRadius: 8, padding: "6px 12px",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                        color: pixCopied ? "#00c853" : "var(--primary)",
                        fontSize: 12, fontWeight: 600, transition: "all 0.2s",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {pixCopied ? <><CheckCircle size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                    </button>
                  </div>
                </div>

                {/* Polling indicator */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  color: "var(--text-secondary)", fontSize: 13
                }}>
                  <Loader2 size={16} className="spin" />
                  Aguardando confirmação do pagamento...
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
