import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, Users, Trash2 } from "lucide-react";

import type { Queue } from "../../shared/types";

import { api } from "./lib/api";

export function QueueSettings({ onBack }: { onBack: () => void }) {
    const [items, setItems] = useState<Queue[]>([]);
    const [newName, setNewName] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchQueues();
    }, []);

    const fetchQueues = () => {
        api.get<Queue[]>("/api/queues")
            .then((res) => {
                if (Array.isArray(res.data)) {
                    setItems(res.data);
                } else {
                    console.error("API returned non-array for queues:", res.data);
                    setItems([]);
                }
            })
            .catch(console.error);
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setLoading(true);
        try {
            await api.post("/api/queues", { name: newName });
            fetchQueues();
            setNewName("");
        } catch (error: any) {
            const err = error.response?.data || {};
            alert("Erro ao criar fila: " + (err.error || error.message));
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, currentName: string) => {
        if (!confirm(`Deletar a fila "${currentName}"? Conversas não resolvidas ficarão sem fila.`)) return;
        try {
            await api.delete(`/api/queues/${id}`);
            setItems(items.filter((i) => i.QueueId !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const token = localStorage.getItem("token");
    const role = useMemo(() => {
        if (!token) return "AGENT";
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            return payload.role;
        } catch { return "AGENT"; }
    }, [token]);

    const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

    return (
        <div style={{ padding: 30, color: "var(--text-primary)", overflowY: "auto", flex: 1 }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
                <button onClick={onBack} title="Voltar" className="btn icon-btn" style={{ marginRight: 15, background: "transparent", border: "none" }}>
                    <ArrowLeft size={24} color="var(--text-secondary)" />
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: "1.8rem", display: "flex", alignItems: "center", gap: 10 }}>
                        <Users size={28} color="#00a884" /> Gestão de Filas
                    </h1>
                    <p style={{ opacity: 0.7, margin: "5px 0 0 0", fontSize: "0.95rem" }}>
                        {isAdmin ? "Crie departamentos para organizar o atendimento." : "Visualize os departamentos ativos para o atendimento."}
                    </p>
                </div>
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                {/* Formulário Criar Nova Fila (Apenas Admin) */}
                {isAdmin && (
                    <div className="login-card" style={{ flex: "1 1 300px", margin: 0 }}>
                        <h3 style={{ margin: "0 0 15px 0", color: "var(--text-primary)" }}>Nova Fila</h3>
                        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                            <div className="field">
                                <label>Nome do Departamento</label>
                                <input
                                    placeholder="ex: Suporte Técnico"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading || !newName.trim()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                <Plus size={18} /> {loading ? "Criando..." : "Criar Fila"}
                            </button>
                        </form>
                    </div>
                )}

                {/* Lista de Filas */}
                <div style={{ flex: isAdmin ? "2 1 400px" : "1 1 100%", display: "flex", flexDirection: "column", gap: 15 }}>
                    {items.length === 0 && (
                        <div style={{ padding: 30, textAlign: "center", background: "var(--bg-secondary)", borderRadius: 12, border: "1px dashed var(--border)", color: "var(--text-secondary)" }}>
                            Nenhuma fila cadastrada ainda.
                        </div>
                    )}
                    {items.map((item) => (
                        <div key={item.QueueId} style={{
                            background: "var(--bg-secondary)",
                            padding: "15px 20px",
                            borderRadius: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            borderLeft: "4px solid #00a884"
                        }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: "1.1rem", color: "var(--text-primary)" }}>{item.Name}</div>
                                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
                                    Status: {item.IsActive ? "Ativa" : "Inativa"}
                                </div>
                            </div>
                            {isAdmin && (
                                <button
                                    onClick={() => handleDelete(item.QueueId, item.Name)}
                                    className="icon-btn"
                                    title="Excluir Fila"
                                    style={{ color: "#ea4335" }}
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
