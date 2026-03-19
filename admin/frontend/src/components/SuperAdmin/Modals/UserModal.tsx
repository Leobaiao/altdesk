import React, { useState } from "react";
import { Users as UsersIcon } from "lucide-react";

interface UserModalProps {
    editUser?: any;
    tenants: any[];
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
}

export function UserModal({ editUser, tenants, onClose, onSubmit }: UserModalProps) {
    const [userTenantId, setUserTenantId] = useState(editUser?.TenantId || "");
    const [userName, setUserName] = useState(editUser?.AgentName || editUser?.Name || "");
    const [userEmail, setUserEmail] = useState(editUser?.Email || "");
    const [userPassword, setUserPassword] = useState("");
    const [userRole, setUserRole] = useState(editUser?.Role || "AGENT");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit({
            tenantId: userTenantId,
            name: userName,
            email: userEmail,
            role: userRole,
            password: userPassword || undefined
        });
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
                width: "100%", maxWidth: 450,
                padding: 32,
                borderRadius: 20,
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <UsersIcon size={24} className="text-accent" />
                    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>{editUser ? "Editar Usuário" : "Novo Usuário"}</h2>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 28 }}>
                    {editUser ? "Atualize as informações do usuário selecionado." : "Adicione um novo usuário ao sistema ou a uma empresa."}
                </p>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Empresa (Tenant)</label>
                        <select required value={userTenantId} onChange={e => setUserTenantId(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white", cursor: "pointer", outline: "none" }}>
                            <option value="" disabled>Selecione uma empresa</option>
                            {tenants.map(t => (
                                <option key={t.TenantId} value={t.TenantId}>{t.Name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Nome Completo</label>
                        <input required value={userName} onChange={e => setUserName(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }} placeholder="Nome do usuário" />
                    </div>

                    <div className="field">
                        <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Email (Login)</label>
                        <input required type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }} placeholder="exem@email.com" />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="field">
                            <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Permissão</label>
                            <select required value={userRole} onChange={e => setUserRole(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white", cursor: "pointer", outline: "none" }}>
                                <option value="AGENT">Agente</option>
                                <option value="ADMIN">Gerente (Admin)</option>
                                <option value="SUPERADMIN">Root (SuperAdmin)</option>
                            </select>
                        </div>
                        <div className="field">
                            <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Senha</label>
                            <input type="password" required={!editUser} placeholder={editUser ? "••••••" : "Mín. 6 carac."} value={userPassword} onChange={e => setUserPassword(e.target.value)} style={{ width: "100%", marginTop: 8, background: "var(--bg-primary)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", color: "white" }} />
                        </div>
                    </div>
                    {editUser && <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: -12 }}>Deixe a senha em branco para não alterar.</p>}

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 12 }}>
                        <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: "12px 24px", borderRadius: 12 }}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" style={{ padding: "12px 24px", borderRadius: 12 }}>{editUser ? "Salvar Alterações" : "Criar Usuário"}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
