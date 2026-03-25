import React, { useState } from "react";
import { api } from "./lib/api";
import { useNavigate } from "react-router-dom";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await api.post("/api/public/forgot-password", { email });
      setMessage(res.data.message);
    } catch (err: any) {
      setError(err.response?.data?.error || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Recuperar Senha</h1>
        <p>Digite seu email para receber um link de recuperação.</p>

        {message && <div style={{ color: "var(--success)", marginBottom: 15 }}>{message}</div>}
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="seu@email.com" 
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Enviando..." : "Enviar Link"}
          </button>
        </form>
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button className="btn" onClick={() => navigate("/login")} style={{ background: "none", color: "var(--text-secondary)" }}>
            Voltar para o Login
          </button>
        </div>
      </div>
    </div>
  );
}
