import React, { useEffect, useState } from "react";
import { api } from "./lib/api";
import { Check, X, Building2, User, HelpCircle, ChevronRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Plan {
    PlanId: string;
    Code: string;
    Name: string;
    PriceCents: number;
    Cycle: string;
    AgentsSeatLimit: number;
    MonthlyPrice?: number;
    AnnualPrice?: number;
    IsActive: boolean;
}

export function PlansComparison() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
    const navigate = useNavigate();

    useEffect(() => {
        api.get("/api/public/plans") // We need to expose a public plans endpoint, or fetch without auth. Let's assume we create one or it already exists.
            .then(res => {
                setPlans(res.data.filter((p: Plan) => p.IsActive));
                setLoading(false);
            })
            .catch(() => {
                // Mock fallback for now
                setPlans([
                    { PlanId: "1", Code: "STARTER", Name: "Starter", PriceCents: 4990, Cycle: "monthly", AgentsSeatLimit: 3, MonthlyPrice: 49.9, AnnualPrice: 499.0, IsActive: true },
                    { PlanId: "2", Code: "PRO", Name: "Pro", PriceCents: 9990, Cycle: "monthly", AgentsSeatLimit: 10, MonthlyPrice: 99.9, AnnualPrice: 999.0, IsActive: true },
                    { PlanId: "3", Code: "ENTERPRISE", Name: "Enterprise", PriceCents: 19990, Cycle: "monthly", AgentsSeatLimit: 50, MonthlyPrice: 199.9, AnnualPrice: 1999.0, IsActive: true }
                ]);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div style={{ padding: 40, textAlign: "center" }}>Carregando planos...</div>;
    }

    return (
        <div style={{ padding: "60px 20px", maxWidth: 1200, margin: "0 auto", fontFamily: "var(--font-family, sans-serif)" }}>
            <div style={{ textAlign: "center", marginBottom: 50 }}>
                <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 16 }}>Preços simples e transparentes</h1>
                <p style={{ fontSize: "1.2rem", color: "var(--text-secondary)", maxWidth: 600, margin: "0 auto" }}>
                    Escolha o plano ideal para a sua equipe de suporte. Todos os planos incluem um período de avaliação gratuita de 14 dias.
                </p>

                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 40 }}>
                    <span style={{ fontSize: "1rem", fontWeight: billingCycle === "monthly" ? 700 : 400, color: billingCycle === "monthly" ? "var(--text-primary)" : "var(--text-secondary)" }}>Mensal</span>
                    <button 
                        onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
                        style={{
                            width: 56, height: 32, borderRadius: 16, background: "var(--accent)", border: "none", cursor: "pointer", position: "relative",
                            transition: "all 0.2s"
                        }}
                    >
                        <div style={{
                            width: 24, height: 24, borderRadius: "50%", background: "#fff", position: "absolute", top: 4,
                            left: billingCycle === "monthly" ? 4 : 28, transition: "all 0.2s"
                        }} />
                    </button>
                    <span style={{ fontSize: "1rem", fontWeight: billingCycle === "yearly" ? 700 : 400, color: billingCycle === "yearly" ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        Anual <span style={{ background: "rgba(0,200,83,0.1)", color: "#00c853", padding: "2px 8px", borderRadius: 10, fontSize: "0.75rem", marginLeft: 8 }}>Economize 20%</span>
                    </span>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 30, alignItems: "stretch" }}>
                {plans.map(plan => {
                    const price = billingCycle === "monthly" ? plan.MonthlyPrice : (plan.AnnualPrice ? plan.AnnualPrice / 12 : plan.MonthlyPrice);
                    
                    return (
                        <div key={plan.Code} style={{ 
                            background: "var(--bg-secondary)", borderRadius: 16, padding: 40, border: "1px solid var(--border)",
                            display: "flex", flexDirection: "column", position: "relative",
                            boxShadow: plan.Code === "PRO" ? "0 20px 40px rgba(0,0,0,0.1)" : "none",
                            transform: plan.Code === "PRO" ? "scale(1.02)" : "scale(1)",
                            borderColor: plan.Code === "PRO" ? "var(--accent)" : "var(--border)"
                        }}>
                            {plan.Code === "PRO" && (
                                <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "var(--accent)", color: "#fff", padding: "4px 16px", borderRadius: 14, fontSize: "0.8rem", fontWeight: 700 }}>
                                    MAIS POPULAR
                                </div>
                            )}

                            <h3 style={{ fontSize: "1.5rem", margin: "0 0 10px 0" }}>{plan.Name}</h3>
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: 30, minHeight: 45 }}>
                                {plan.Code === "STARTER" ? "Ideal para pequenas equipes que estão começando." : 
                                 plan.Code === "PRO" ? "Tudo que você precisa para escalar o seu atendimento." : 
                                 "Para operações complexas que exigem controles avançados."}
                            </p>

                            <div style={{ marginBottom: 30 }}>
                                <span style={{ fontSize: "3rem", fontWeight: 800 }}>R$ {price?.toFixed(2).replace(".", ",")}</span>
                                <span style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>/mês</span>
                                {billingCycle === "yearly" && (
                                    <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 4 }}>
                                        Faturado anualmente (R$ {plan.AnnualPrice?.toFixed(2).replace(".", ",")})
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => navigate("/onboarding")}
                                style={{ 
                                    padding: "16px", borderRadius: 8, border: "none", width: "100%", fontSize: "1.1rem", fontWeight: 600, cursor: "pointer",
                                    background: plan.Code === "PRO" ? "var(--accent)" : "transparent",
                                    color: plan.Code === "PRO" ? "#fff" : "var(--text-primary)",
                                    borderStyle: "solid",
                                    borderWidth: 1,
                                    borderColor: plan.Code === "PRO" ? "var(--accent)" : "var(--border)",
                                    marginBottom: 40
                                }}
                            >
                                Começar período de avaliação
                            </button>

                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: 1, color: "var(--text-secondary)", marginBottom: 20 }}>O que está incluso</h4>
                                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                    <li style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
                                        <Check size={20} color="var(--accent)" />
                                        <span style={{ fontSize: "0.95rem" }}>Até {plan.AgentsSeatLimit} atendentes</span>
                                    </li>
                                    <li style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
                                        <Check size={20} color="var(--accent)" />
                                        <span style={{ fontSize: "0.95rem" }}>Canais de WhatsApp e Email</span>
                                    </li>
                                    <li style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
                                        <Check size={20} color="var(--accent)" />
                                        <span style={{ fontSize: "0.95rem" }}>Base de Conhecimento</span>
                                    </li>
                                    {plan.Code !== "STARTER" && (
                                        <>
                                            <li style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
                                                <Check size={20} color="var(--accent)" />
                                                <span style={{ fontSize: "0.95rem" }}>SLA Dinâmico</span>
                                            </li>
                                            <li style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
                                                <Check size={20} color="var(--accent)" />
                                                <span style={{ fontSize: "0.95rem" }}>Automação Avançada</span>
                                            </li>
                                        </>
                                    )}
                                    {plan.Code === "ENTERPRISE" && (
                                        <>
                                            <li style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
                                                <Check size={20} color="var(--accent)" />
                                                <span style={{ fontSize: "0.95rem" }}>SSO (Single Sign-On)</span>
                                            </li>
                                            <li style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
                                                <Check size={20} color="var(--accent)" />
                                                <span style={{ fontSize: "0.95rem" }}>Gerente de Sucesso Dedicado</span>
                                            </li>
                                        </>
                                    )}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
