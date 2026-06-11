import React from "react";
import { useNavigate } from "react-router-dom";
import { Gift, CheckCircle, ArrowRight, LogOut, MessageSquare } from "lucide-react";
import LogoHorizontal from "./assets/logo/logo-horizontal.png";

export function SpecialOffer() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const handleTalkToSales = () => {
    // Redireciona para o WhatsApp oficial com mensagem personalizada
    const phone = "5511999999999"; // Exemplo de número de vendas do AltDesk
    const text = encodeURIComponent("Olá! Meu período de avaliação no AltDesk terminou e gostaria de aproveitar a condição especial de adesão.");
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  return (
    <div className="login-container" style={{ background: "linear-gradient(135deg, var(--bg-primary) 0%, rgba(0, 168, 132, 0.05) 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div className="login-card" style={{ maxWidth: "600px", width: "100%", padding: "40px", borderRadius: "24px", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.12)", border: "1px solid var(--border)", background: "var(--bg-secondary)", position: "relative" }}>
        
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <img src={LogoHorizontal} alt="AltDesk Logo" style={{ maxWidth: "180px", height: "auto" }} />
        </div>

        {/* Badge de Oferta */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0, 168, 132, 0.1)", color: "var(--accent)", padding: "8px 16px", borderRadius: "100px", fontSize: "0.85rem", fontWeight: 700, marginBottom: 20 }}>
          <Gift size={16} /> Condição Especial de Entrada
        </div>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 15, letterSpacing: "-0.5px" }}>
          Sua jornada no AltDesk está apenas começando!
        </h1>
        
        <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.6, marginBottom: 30 }}>
          O seu período de testes (incluindo a prorrogação de 7 dias) se encerrou. Para garantir que sua operação não pare e você continue escalando seus atendimentos, preparamos uma condição exclusiva:
        </p>

        {/* Benefícios */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 35, textAlign: "left" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <CheckCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: "var(--text-primary)" }}>Desconto de 20% nas 3 primeiras mensalidades:</strong>
              <span style={{ color: "var(--text-secondary)", display: "block", fontSize: "0.9rem" }}>Condição válida para qualquer plano escolhido hoje.</span>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <CheckCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: "var(--text-primary)" }}>Migração Gratuita de Dados:</strong>
              <span style={{ color: "var(--text-secondary)", display: "block", fontSize: "0.9rem" }}>Importamos seus contatos e histórico sem custos adicionais.</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <CheckCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: "var(--text-primary)" }}>Suporte Prioritário na Implantação:</strong>
              <span style={{ color: "var(--text-secondary)", display: "block", fontSize: "0.9rem" }}>Um especialista dedicado para ajudar a plugar seus canais.</span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button 
            onClick={handleTalkToSales} 
            className="btn btn-primary" 
            style={{ padding: "14px 24px", fontSize: "1.05rem", fontWeight: 700, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", border: "none", width: "100%" }}
          >
            <MessageSquare size={20} /> Falar com Vendas e Ativar Desconto
          </button>

          <button 
            onClick={() => navigate("/billing")} 
            className="btn btn-secondary" 
            style={{ padding: "14px 24px", fontSize: "1.05rem", fontWeight: 700, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", width: "100%", background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            Ver Planos no Painel <ArrowRight size={18} />
          </button>
        </div>

        {/* Link de Sair */}
        <div style={{ marginTop: 30, display: "flex", justifyContent: "center" }}>
          <button 
            onClick={handleLogout} 
            style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}
          >
            <LogOut size={16} /> Desconectar desta conta
          </button>
        </div>

      </div>
    </div>
  );
}
