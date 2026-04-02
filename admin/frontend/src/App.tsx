import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { SuperAdmin } from "./SuperAdmin";
import { api } from "./lib/api";
import { parseJwt } from "./lib/auth";
import "./index.css"; // Ensure styles are imported
import LogoHorizontal from "./assets/logo/logo-horizontal.png";

// ─── Login ────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (token: string, role: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const data = res.data;
      localStorage.setItem("token", data.token);
      onLogin(data.token, data.role);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <div style={{ textAlign: "center", marginBottom: 25 }}>
          <img src={LogoHorizontal} alt="AltDesk Admin" style={{ maxWidth: "70px", height: "auto" }} />
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: 8, fontWeight: 500, letterSpacing: 1 }}>PAINEL CORPORATIVO</div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@altdesk.local" />
        </div>
        <div className="field">
          <label>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────
function AppContent() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      const decoded = parseJwt(token);
      if (!decoded || !decoded.tenantId) {
        handleLogout();
      } else if (!role && decoded.role) {
        setRole(decoded.role);
      }
    } else {
      navigate("/login");
    }
  }, [token, role, navigate]);

  function handleLogin(newToken: string, newRole: string) {
    if (newRole !== "SUPERADMIN") {
      alert("Acesso Negado: Apenas Super Admins podem acessar este painel.");
      handleLogout();
      return;
    }
    setToken(newToken);
    setRole(newRole);
    navigate("/");
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken(null);
    setRole(null);
    navigate("/login");
  }

  if (!token) {
    return (
      <Routes>
        <Route path="*" element={<LoginScreen onLogin={handleLogin} />} />
      </Routes>
    );
  }

  if (role !== "SUPERADMIN") {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <h2>Acesso Negado</h2>
        <p>Apenas perfis SUPERADMIN podem acessar o gerenciador.</p>
        <button className="btn btn-primary" onClick={handleLogout}>Sair</button>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Ocupa a tela inteira sem o Sidebar do chat */}
      <div className="chat-area admin-chat-area" style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <Routes>
          <Route path="/" element={<SuperAdmin token={token} onBack={handleLogout} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
