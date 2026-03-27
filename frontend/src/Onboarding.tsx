import React, { useState } from "react";
import { api } from "./lib/api";
import {
  Building2,
  User,
  Server,
  Boxes,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  LogIn,
  RotateCcw,
} from "lucide-react";

type PreloadModel = "empty" | "basic" | "demo";

interface OnboardingData {
  companyName: string;
  tradeName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  password: string;
  confirmPassword: string;
  preloadModel: PreloadModel;
}

const initial: OnboardingData = {
  companyName: "",
  tradeName: "",
  cpfCnpj: "",
  email: "",
  phone: "",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  password: "",
  confirmPassword: "",
  preloadModel: "empty",
};

// ─── Step 1: Cadastro ──────────────────────────────
function Step1({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div className="onboarding-split">
      <div className="onboarding-left">
        <div className="onboarding-icon-circle">
          <Building2 size={32} />
        </div>
        <h2>Comece seu ambiente no Altdesk</h2>
        <p>
          Crie sua empresa e seu usuário administrador para acessar a plataforma
          pela primeira vez. Em poucos passos você poderá testar tickets, filas,
          atendimento e operação omnichannel.
        </p>
        <ul className="onboarding-benefits">
          <li><Check size={16} /> Ambiente pronto para avaliação</li>
          <li><Check size={16} /> Estrutura inicial criada automaticamente</li>
          <li><Check size={16} /> Você escolhe como deseja começar</li>
          <li><Check size={16} /> Sem configuração complexa</li>
        </ul>
      </div>
      <div className="onboarding-right">
        <h3><Building2 size={18} /> Dados da Empresa</h3>
        <div className="onboarding-row">
          <div className="field">
            <label>Nome da empresa *</label>
            <input value={data.companyName} onChange={e => onChange({ companyName: e.target.value })} placeholder="Razão social" />
          </div>
          <div className="field">
            <label>Nome fantasia</label>
            <input value={data.tradeName} onChange={e => onChange({ tradeName: e.target.value })} placeholder="Nome fantasia" />
          </div>
        </div>
        <div className="onboarding-row">
          <div className="field">
            <label>CNPJ ou CPF</label>
            <input value={data.cpfCnpj} onChange={e => onChange({ cpfCnpj: e.target.value })} placeholder="00.000.000/0001-00" />
          </div>
          <div className="field">
            <label>E-mail principal *</label>
            <input type="email" value={data.email} onChange={e => onChange({ email: e.target.value })} placeholder="contato@empresa.com" />
          </div>
        </div>
        <div className="field">
          <label>Telefone principal</label>
          <input value={data.phone} onChange={e => onChange({ phone: e.target.value })} placeholder="(11) 3333-4444" />
        </div>

        <h3 style={{ marginTop: 24 }}><User size={18} /> Dados do Administrador</h3>
        <div className="onboarding-row">
          <div className="field">
            <label>Nome completo *</label>
            <input value={data.adminName} onChange={e => onChange({ adminName: e.target.value })} placeholder="Seu nome" />
          </div>
          <div className="field">
            <label>E-mail de acesso *</label>
            <input type="email" value={data.adminEmail} onChange={e => onChange({ adminEmail: e.target.value })} placeholder="seu@email.com" />
          </div>
        </div>
        <div className="field">
          <label>Telefone</label>
          <input value={data.adminPhone} onChange={e => onChange({ adminPhone: e.target.value })} placeholder="(11) 99999-0000" />
        </div>
        <div className="onboarding-row">
          <div className="field">
            <label>Senha *</label>
            <input type="password" value={data.password} onChange={e => onChange({ password: e.target.value })} placeholder="••••••" />
          </div>
          <div className="field">
            <label>Confirmar senha *</label>
            <input type="password" value={data.confirmPassword} onChange={e => onChange({ confirmPassword: e.target.value })} placeholder="••••••" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Preload ───────────────────────────────
function Step2({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  const cards: { model: PreloadModel; icon: React.ReactNode; title: string; desc: string; details: string }[] = [
    {
      model: "empty",
      icon: <Server size={28} />,
      title: "Ambiente Limpo",
      desc: "Sem tickets, contatos ou exemplos.",
      details: "Ideal para quem deseja configurar tudo do zero.",
    },
    {
      model: "basic",
      icon: <Boxes size={28} />,
      title: "Dados Básicos",
      desc: "Estrutura mínima com filas e contatos.",
      details: "1 agente, 2 filas, 5 contatos para entender o fluxo.",
    },
    {
      model: "demo",
      icon: <Sparkles size={28} />,
      title: "Demonstração Completa",
      desc: "Cenário realista para avaliação.",
      details: "4 agentes, 4 filas, 12 contatos com dados simulados.",
    },
  ];

  return (
    <div className="onboarding-split">
      <div className="onboarding-left">
        <div className="onboarding-icon-circle">
          <Boxes size={32} />
        </div>
        <h2>Escolha como deseja começar</h2>
        <p>
          O Altdesk pode criar um ambiente inicial para facilitar sua avaliação.
          Você escolhe o nível de dados que deseja receber.
        </p>
        <p style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
          Cada opção cria uma base inicial diferente. Depois você poderá editar,
          excluir ou reiniciar o ambiente.
        </p>
      </div>
      <div className="onboarding-right">
        <div className="preload-cards">
          {cards.map(c => (
            <div
              key={c.model}
              className={`preload-card ${data.preloadModel === c.model ? "selected" : ""}`}
              onClick={() => onChange({ preloadModel: c.model })}
            >
              <div className="preload-card-icon">{c.icon}</div>
              <div className="preload-card-body">
                <h4>{c.title}</h4>
                <p>{c.desc}</p>
                <span className="preload-card-detail">{c.details}</span>
              </div>
              {data.preloadModel === c.model && (
                <div className="preload-card-check"><Check size={20} /></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Resumo ────────────────────────────────
function Step3({ data }: { data: OnboardingData }) {
  const modelLabels: Record<PreloadModel, string> = {
    empty: "Ambiente Limpo",
    basic: "Dados Básicos",
    demo: "Demonstração Completa",
  };

  return (
    <div className="onboarding-split">
      <div className="onboarding-left">
        <div className="onboarding-icon-circle">
          <Check size={32} />
        </div>
        <h2>Revise seu ambiente inicial</h2>
        <p>
          Confira os dados e o modelo selecionado. Ao continuar, o Altdesk irá
          criar sua empresa, seu usuário administrador e os dados iniciais.
        </p>
        <p style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
          Você poderá editar essas informações depois dentro da plataforma.
        </p>
      </div>
      <div className="onboarding-right">
        <div className="summary-section">
          <h4><Building2 size={16} /> Empresa</h4>
          <div className="summary-grid">
            <div><span>Nome</span><strong>{data.companyName}</strong></div>
            {data.tradeName && <div><span>Fantasia</span><strong>{data.tradeName}</strong></div>}
            {data.cpfCnpj && <div><span>CNPJ/CPF</span><strong>{data.cpfCnpj}</strong></div>}
            <div><span>E-mail</span><strong>{data.email}</strong></div>
            {data.phone && <div><span>Telefone</span><strong>{data.phone}</strong></div>}
          </div>
        </div>
        <div className="summary-section">
          <h4><User size={16} /> Administrador</h4>
          <div className="summary-grid">
            <div><span>Nome</span><strong>{data.adminName}</strong></div>
            <div><span>E-mail</span><strong>{data.adminEmail}</strong></div>
            {data.adminPhone && <div><span>Telefone</span><strong>{data.adminPhone}</strong></div>}
          </div>
        </div>
        <div className="summary-section">
          <h4><Boxes size={16} /> Configuração</h4>
          <div className="summary-grid">
            <div><span>Modelo</span><strong>{modelLabels[data.preloadModel]}</strong></div>
            <div><span>Timezone</span><strong>America/Sao_Paulo</strong></div>
            <div><span>Idioma</span><strong>Português (BR)</strong></div>
            <div><span>Trial</span><strong>14 dias</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Sucesso ───────────────────────────────
function Step4({ preloadModel, onEnter }: { preloadModel: PreloadModel; onEnter: () => void }) {
  return (
    <div className="onboarding-split">
      <div className="onboarding-left">
        <div className="onboarding-icon-circle success">
          <Sparkles size={32} />
        </div>
        <h2>Seu ambiente está pronto!</h2>
        <p>
          O Altdesk concluiu a criação da sua conta e do ambiente inicial.
          Agora você já pode entrar no painel e começar sua avaliação.
        </p>
        {preloadModel === "demo" && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--accent)" }}>
            📋 Seu ambiente foi criado com dados simulados para demonstração.
            Você pode editá-los ou removê-los a qualquer momento.
          </p>
        )}
      </div>
      <div className="onboarding-right" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <div className="success-checkmarks">
          <div className="success-item"><Check size={20} /> Empresa criada com sucesso</div>
          <div className="success-item"><Check size={20} /> Administrador criado com sucesso</div>
          <div className="success-item"><Check size={20} /> Ambiente aplicado com sucesso</div>
        </div>
        <button className="btn btn-primary" style={{ padding: "16px 40px", fontSize: 16, gap: 8 }} onClick={onEnter}>
          <LogIn size={20} /> Entrar no Altdesk
        </button>
      </div>
    </div>
  );
}

// ─── Main Onboarding ───────────────────────────────
export function Onboarding({ onLogin }: { onLogin: (token: string, role: string) => void }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateData(partial: Partial<OnboardingData>) {
    setData(prev => ({ ...prev, ...partial }));
  }

  function validateStep1(): string | null {
    if (!data.companyName.trim()) return "Nome da empresa é obrigatório.";
    if (!data.email.trim()) return "E-mail da empresa é obrigatório.";
    if (!data.adminName.trim()) return "Nome do administrador é obrigatório.";
    if (!data.adminEmail.trim()) return "E-mail do administrador é obrigatório.";
    if (data.password.length < 6) return "Senha deve ter no mínimo 6 caracteres.";
    if (data.password !== data.confirmPassword) return "As senhas não coincidem.";
    return null;
  }

  function handleNext() {
    setError("");
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    setStep(s => Math.min(s + 1, 4));
  }

  function handleBack() {
    setError("");
    setStep(s => Math.max(s - 1, 1));
  }

  async function handleCreate() {
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/onboarding", {
        companyName: data.companyName,
        tradeName: data.tradeName,
        cpfCnpj: data.cpfCnpj,
        email: data.email,
        phone: data.phone,
        adminName: data.adminName,
        adminEmail: data.adminEmail,
        adminPhone: data.adminPhone,
        password: data.password,
        preloadModel: data.preloadModel,
      });
      localStorage.setItem("token", res.data.token);
      setStep(4);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Erro ao criar ambiente.");
    } finally {
      setLoading(false);
    }
  }

  function handleEnter() {
    const token = localStorage.getItem("token");
    if (token) {
      onLogin(token, "ADMIN");
    }
  }

  const stepLabels = ["Cadastro", "Ambiente", "Revisão", "Pronto"];

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        {/* Progress Bar */}
        <div className="onboarding-progress">
          {stepLabels.map((label, i) => (
            <div key={i} className={`progress-step ${i + 1 <= step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}>
              <div className="progress-dot">
                {i + 1 < step ? <Check size={14} /> : <span>{i + 1}</span>}
              </div>
              <span className="progress-label">{label}</span>
              {i < stepLabels.length - 1 && <div className="progress-line" />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <div className="onboarding-error">{error}</div>}

        {/* Steps */}
        <div className="onboarding-body">
          {step === 1 && <Step1 data={data} onChange={updateData} />}
          {step === 2 && <Step2 data={data} onChange={updateData} />}
          {step === 3 && <Step3 data={data} />}
          {step === 4 && <Step4 preloadModel={data.preloadModel} onEnter={handleEnter} />}
        </div>

        {/* Actions */}
        {step < 4 && (
          <div className="onboarding-actions">
            {step > 1 && (
              <button className="onboarding-btn-back" onClick={handleBack} type="button">
                <ArrowLeft size={16} /> Voltar
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step === 1 && (
              <button className="btn btn-primary" onClick={handleNext} style={{ gap: 8 }} type="button">
                Continuar <ArrowRight size={16} />
              </button>
            )}
            {step === 2 && (
              <button className="btn btn-primary" onClick={handleNext} style={{ gap: 8 }} type="button">
                Revisar Dados <ArrowRight size={16} />
              </button>
            )}
            {step === 3 && (
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading} style={{ gap: 8 }} type="button">
                {loading ? <><Loader2 size={16} className="spin" /> Criando...</> : <>Criar Ambiente <Sparkles size={16} /></>}
              </button>
            )}
          </div>
        )}

        {/* Footer link */}
        {step === 1 && (
          <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 10 }}>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Já tem uma conta?{" "}
              <a href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>Faça login</a>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
