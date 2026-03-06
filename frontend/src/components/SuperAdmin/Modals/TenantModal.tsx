import React, { useState } from "react";

interface TenantModalProps {
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
}

export function TenantModal({ onClose, onSubmit }: TenantModalProps) {
    const [companyName, setCompanyName] = useState("");
    const [adminName, setAdminName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [planDays, setPlanDays] = useState(30);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit({ companyName, adminName, email, password, planDays });
        onClose();
    };

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
            <div style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                width: "100%", maxWidth: 480,
                padding: 32,
                borderRadius: 20,
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: "1.5rem" }}>🏢</span>
                    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>Nova Empresa (Tenant)</h2>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 28 }}>
                    Crie um novo ambiente isolado para o seu cliente.
                </p>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Nome da Empresa</label>
                        <input required value={companyName} onChange={e => setCompanyName(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="field">
                            <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Nome do Admin</label>
                            <input required value={adminName} onChange={e => setAdminName(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }} />
                        </div>
                        <div className="field">
                            <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Dias de Plano</label>
                            <input type="number" value={planDays} onChange={e => setPlanDays(Number(e.target.value))} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }} />
                        </div>
                    </div>

                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Email do Admin (Login)</label>
                        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }} placeholder="exem@email.com" />
                    </div>

                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Senha Inicial</label>
                        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }} />
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 12 }}>
                        <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: "12px 24px", borderRadius: 12 }}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" style={{ padding: "12px 24px", borderRadius: 12 }}>Criar Empresa</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
