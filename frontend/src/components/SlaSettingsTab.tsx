import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Plus, Trash2, Edit2, ShieldCheck } from "lucide-react";

export function SlaSettingsTab() {
    const [policies, setPolicies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        priority: "LOW",
        firstResponseMinutes: 60,
        resolutionMinutes: 1440,
        warningBeforeMinutes: 10,
        businessHoursOnly: false
    });
    const [error, setError] = useState("");

    const fetchPolicies = async () => {
        try {
            const res = await api.get("/api/settings/sla");
            setPolicies(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            if (editingId) {
                await api.put(`/api/settings/sla/${editingId}`, formData);
            } else {
                await api.post("/api/settings/sla", formData);
            }
            setShowModal(false);
            fetchPolicies();
        } catch (err: any) {
            setError(err.response?.data?.error || "Erro ao salvar política de SLA.");
        }
    };

    const handleEdit = (p: any) => {
        setFormData({
            priority: p.Priority,
            firstResponseMinutes: p.FirstResponseMinutes,
            resolutionMinutes: p.ResolutionMinutes,
            warningBeforeMinutes: p.WarningBeforeMinutes,
            businessHoursOnly: p.BusinessHoursOnly
        });
        setEditingId(p.PolicyId);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta política?")) return;
        try {
            await api.delete(`/api/settings/sla/${id}`);
            fetchPolicies();
        } catch (err) {
            console.error(err);
        }
    };

    const openNew = () => {
        setFormData({
            priority: "LOW",
            firstResponseMinutes: 60,
            resolutionMinutes: 1440,
            warningBeforeMinutes: 10,
            businessHoursOnly: false
        });
        setEditingId(null);
        setShowModal(true);
    };

    if (loading) return <div style={{ color: "var(--text-secondary)" }}>Carregando SLAs...</div>;

    const translatePriority = (p: string) => {
        const m: any = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica', URGENT: 'Urgente' };
        return m[p] || p;
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                        <ShieldCheck size={20} className="text-accent" /> Níveis de SLA
                    </h3>
                    <p style={{ margin: "6px 0 0 0", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                        Configure o tempo máximo esperado para a 1ª resposta e resolução de acordo com a prioridade do chamado.
                    </p>
                </div>
                <button onClick={openNew} className="btn btn-primary" style={{ padding: "10px 18px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <Plus size={18} /> Adicionar Nível
                </button>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", color: "var(--text-primary)" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                            <th style={{ padding: "12px 16px", textAlign: "left", borderRadius: "10px 0 0 10px", fontWeight: 600 }}>Prioridade</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600 }}>1ª Resposta (min)</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600 }}>Resolução (min)</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600 }}>Aviso (min)</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600 }}>Horário Com.</th>
                            <th style={{ padding: "12px 16px", textAlign: "right", borderRadius: "0 10px 10px 0", fontWeight: 600 }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {policies.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-secondary)" }}>Nenhuma política de SLA configurada.</td></tr>
                        ) : (
                            policies.map(p => (
                                <tr key={p.PolicyId} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg-primary)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    <td style={{ padding: "16px", fontWeight: 600 }}>{translatePriority(p.Priority)}</td>
                                    <td style={{ padding: "16px" }}>{p.FirstResponseMinutes}</td>
                                    <td style={{ padding: "16px" }}>{p.ResolutionMinutes}</td>
                                    <td style={{ padding: "16px" }}>{p.WarningBeforeMinutes}</td>
                                    <td style={{ padding: "16px" }}>{p.BusinessHoursOnly ? "Sim" : "Não"}</td>
                                    <td style={{ padding: "16px", textAlign: "right" }}>
                                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                                            <button onClick={() => handleEdit(p)} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }} title="Editar"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(p.PolicyId)} style={{ background: "transparent", border: "none", color: "#ea4335", cursor: "pointer", padding: 4 }} title="Excluir"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 20, width: "100%", maxWidth: 450, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
                        <h3 style={{ margin: "0 0 20px 0", fontSize: "1.2rem", fontWeight: 600 }}>{editingId ? "Editar Nível de SLA" : "Novo Nível de SLA"}</h3>
                        {error && <div style={{ background: "rgba(234, 67, 53, 0.1)", color: "#ea4335", padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: "0.85rem", border: "1px solid rgba(234, 67, 53, 0.2)" }}>{error}</div>}
                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Prioridade do Chamado</label>
                                <select 
                                    value={formData.priority} 
                                    onChange={e => setFormData({...formData, priority: e.target.value})}
                                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
                                    disabled={!!editingId}
                                >
                                    <option value="LOW">Baixa</option>
                                    <option value="MEDIUM">Média</option>
                                    <option value="HIGH">Alta</option>
                                    <option value="CRITICAL">Crítica</option>
                                    <option value="URGENT">Urgente</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Tempo Máximo p/ 1ª Resposta (minutos)</label>
                                <input 
                                    type="number" min="0" required
                                    value={formData.firstResponseMinutes} 
                                    onChange={e => setFormData({...formData, firstResponseMinutes: parseInt(e.target.value)})}
                                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Tempo Máximo p/ Resolução (minutos)</label>
                                <input 
                                    type="number" min="0" required
                                    value={formData.resolutionMinutes} 
                                    onChange={e => setFormData({...formData, resolutionMinutes: parseInt(e.target.value)})}
                                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Avisar antes de expirar o prazo (minutos)</label>
                                <input 
                                    type="number" min="0" required
                                    value={formData.warningBeforeMinutes} 
                                    onChange={e => setFormData({...formData, warningBeforeMinutes: parseInt(e.target.value)})}
                                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
                                />
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", cursor: "pointer", marginTop: 8, background: "var(--bg-primary)", padding: 12, borderRadius: 10, border: "1px solid var(--border)" }}>
                                <input 
                                    type="checkbox" 
                                    checked={formData.businessHoursOnly}
                                    onChange={e => setFormData({...formData, businessHoursOnly: e.target.checked})}
                                    style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                                />
                                Contabilizar apenas em Horário Comercial
                            </label>
                            
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: "12px 20px", background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ padding: "12px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 600, border: "none" }}>{editingId ? "Salvar Alterações" : "Criar SLA"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
