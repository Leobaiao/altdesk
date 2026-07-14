import React, { useEffect, useState } from "react";
import { api } from "./lib/api";
import { ArrowLeft, CreditCard, FileText, CheckCircle, AlertTriangle, XCircle, Clock, X, Loader2, Trash2, ExternalLink } from "lucide-react";
import { PageHeader } from "./components/PageHeader";
import { useChat } from "./contexts/ChatContext";

interface Plan {
  PlanId: string;
  Code: string;
  Name: string;
  PriceCents: number;
  Cycle: string;
  AgentsSeatLimit: number;
  Features?: string[];
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

  // Checkout state (Asaas Checkout - página hospedada)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null); // planCode being processed

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

  const [checkoutFeedback, setCheckoutFeedback] = useState<"success" | "cancel" | "expired" | null>(null);

  // Processar callback do Asaas Checkout (query params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutResult = params.get("checkout") as "success" | "cancel" | "expired" | null;
    if (checkoutResult) {
      // Limpar query param da URL sem recarregar
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname);

      setCheckoutFeedback(checkoutResult);
      if (checkoutResult === "success") {
        // Recarregar dados após alguns segundos para refletir o webhook
        setTimeout(() => loadAll(), 3000);
      }
    }
  }, []);

  const handleSubscribe = async (plan: Plan) => {
    setCheckoutLoading(plan.Code);
    try {
      const res = await api.post("/api/billing/checkout", { planCode: plan.Code });
      const { link } = res.data;

      // Abrir checkout do Asaas em nova aba
      window.open(link, "_blank");
      showToast("Página de pagamento aberta em nova aba.", "success");
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      showToast(msg || "Erro ao criar checkout.", "error");
    } finally {
      setCheckoutLoading(null);
    }
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
      {/* Checkout Feedback Modal */}
      {checkoutFeedback && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <div style={{
            background: "var(--bg-primary)", padding: 32, borderRadius: 16, maxWidth: 400, width: "100%",
            textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.2)", border: "1px solid var(--border-color)"
          }}>
            {checkoutFeedback === "success" && (
              <>
                <div style={{ color: "#00c853", marginBottom: 16, display: "flex", justifyContent: "center" }}>
                  <CheckCircle size={64} />
                </div>
                <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Pagamento Iniciado!</h2>
                <p style={{ color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
                  Sua transação foi registrada. Se você pagou via PIX ou Cartão, a liberação costuma ser instantânea. Pagamentos via boleto podem levar até 3 dias úteis.
                </p>
              </>
            )}
            {checkoutFeedback === "cancel" && (
              <>
                <div style={{ color: "#ff9800", marginBottom: 16, display: "flex", justifyContent: "center" }}>
                  <AlertTriangle size={64} />
                </div>
                <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Pagamento Cancelado</h2>
                <p style={{ color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
                  Você cancelou o processo de pagamento ou houve uma falha de autenticação. Nenhuma cobrança foi gerada.
                </p>
              </>
            )}
            {checkoutFeedback === "expired" && (
              <>
                <div style={{ color: "#f44336", marginBottom: 16, display: "flex", justifyContent: "center" }}>
                  <XCircle size={64} />
                </div>
                <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Link Expirado</h2>
                <p style={{ color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
                  O tempo limite para pagamento expirou. Por favor, gere um novo link de pagamento se desejar continuar.
                </p>
              </>
            )}
            
            <button 
              onClick={() => setCheckoutFeedback(null)}
              style={{
                width: "100%", padding: "12px", borderRadius: 8, background: "var(--accent)", color: "#fff",
                fontWeight: 600, border: "none", cursor: "pointer", transition: "opacity 0.2s"
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

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
              {plan.PriceCents > 0 ? (
                <>
                  {formatCents(plan.PriceCents)}
                  <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-secondary)" }}>/mês</span>
                </>
              ) : (
                <span style={{ fontSize: 22 }}>Sob consulta</span>
              )}
            </div>
            {plan.Features && plan.Features.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", textAlign: "left" }}>
                {plan.Features.map((feat, idx) => (
                  <li key={idx} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <CheckCircle size={14} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ lineHeight: 1.4 }}>{feat}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0" }}>
                Até {plan.AgentsSeatLimit} atendentes
              </p>
            )}
            {subscription?.PlanCode === plan.Code ? (
              <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600 }}>✓ Plano Atual</span>
            ) : (
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 8, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={() => handleSubscribe(plan)}
                disabled={checkoutLoading === plan.Code}
              >
                {checkoutLoading === plan.Code ? (
                  <><Loader2 size={14} className="spin" /> Abrindo checkout...</>
                ) : (
                  <>{plan.PriceCents > 0 ? "Selecionar" : "Falar com consultor"}</>
                )}
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

    </div>
  );
}
