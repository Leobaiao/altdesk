import React, { useState } from "react";
import { Settings } from "lucide-react";

interface LimitModalProps {
    tenant: any;
    onClose: () => void;
    onSubmit: (limit: number) => Promise<void>;
}

export function LimitModal({ tenant, onClose, onSubmit }: LimitModalProps) {
    const [newLimit, setNewLimit] = useState(tenant.AgentsSeatLimit);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(newLimit);
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
                width: "100%", maxWidth: 400,
                padding: 32,
                borderRadius: 20,
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <Settings size={20} className="text-accent" />
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Limite de Agentes</h3>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 24 }}>
                    Empresa: <b style={{ color: "var(--text-primary)" }}>{tenant.Name}</b>
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="field" style={{ marginBottom: 24 }}>
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Novo Limite de Cadeiras</label>
                        <input
                            type="number"
                            min="1"
                            value={newLimit}
                            onChange={e => setNewLimit(Number(e.target.value))}
                            style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }}
                        />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                        <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: "10px 20px", borderRadius: 10 }}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" style={{ padding: "10px 20px", borderRadius: 10 }}>Salvar Limite</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
