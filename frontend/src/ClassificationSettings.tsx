import React, { useState, useEffect } from "react";
import { Plus, Trash2, Tag as TagIcon, Layers } from "lucide-react";
import { PageHeader } from "./components/PageHeader";
import { api } from "./lib/api";
import type { Tag } from "../../shared/types";
import { SlaSettingsTab } from "./components/SlaSettingsTab";

interface Props {
    onBack: () => void;
}

export function ClassificationSettings({ onBack }: Props) {
    const [subTab, setSubTab] = useState<"tags" | "sla">("tags");
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagDescription, setNewTagDescription] = useState("");
    const [newTagColor, setNewTagColor] = useState("#00a884");
    const [editingTagId, setEditingTagId] = useState<string | null>(null);

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        setLoading(true);
        try {
            const res = await api.get<Tag[]>("/api/tags");
            setTags(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Erro ao carregar tags:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrUpdateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagName.trim() || !newTagDescription.trim()) {
            alert("Nome e Descrição são obrigatórios.");
            return;
        }

        try {
            if (editingTagId) {
                await api.put(`/api/tags/${editingTagId}`, { name: newTagName, description: newTagDescription, color: newTagColor });
            } else {
                await api.post("/api/tags", { name: newTagName, description: newTagDescription, color: newTagColor });
            }
            
            setNewTagName("");
            setNewTagDescription("");
            setNewTagColor("#00a884");
            setEditingTagId(null);
            loadTags();
        } catch (error) {
            console.error("Erro ao salvar tag:", error);
            alert("Erro ao salvar a tag.");
        }
    };

    const handleEditClick = (tag: Tag) => {
        setEditingTagId(tag.TagId);
        setNewTagName(tag.Name);
        setNewTagDescription(tag.Description || "");
        setNewTagColor(tag.Color);
    };

    const handleCancelEdit = () => {
        setEditingTagId(null);
        setNewTagName("");
        setNewTagDescription("");
        setNewTagColor("#00a884");
    };

    const handleDeleteTag = async (tagId: string) => {
        if (!confirm("Tem certeza que deseja apagar esta tag? Ela será removida de todas as conversas.")) return;

        try {
            await api.delete(`/api/tags/${tagId}`);
            loadTags();
        } catch (error) {
            console.error("Erro ao apagar tag:", error);
        }
    };

    return (
        <div className="settings-page" style={{ height: "100%", overflowY: "auto" }}>
            <PageHeader
                title="Classificação e SLAs"
                subtitle="Gerencie as tags das conversas e as políticas de atendimento (SLA)."
                icon={Layers}
                onBack={onBack}
                contextKey="classification.index"
            />

            <div style={{ padding: "0 24px" }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-secondary)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", width: "fit-content" }}>
                    <button
                        onClick={() => setSubTab("tags")}
                        style={{
                            padding: "8px 18px", background: subTab === "tags" ? "var(--accent)" : "transparent",
                            border: "none", color: subTab === "tags" ? "#fff" : "var(--text-secondary)",
                            borderRadius: 8, cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.15s"
                        }}
                    >
                        Tags de Conversa
                    </button>
                    <button
                        onClick={() => setSubTab("sla")}
                        style={{
                            padding: "8px 18px", background: subTab === "sla" ? "var(--accent)" : "transparent",
                            border: "none", color: subTab === "sla" ? "#fff" : "var(--text-secondary)",
                            borderRadius: 8, cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.15s"
                        }}
                    >
                        Políticas de SLA
                    </button>
                </div>

                {subTab === "tags" && (
                    <>

            <div style={{ background: "var(--bg-secondary)", padding: 25, borderRadius: 12, border: "1px solid var(--border)", marginBottom: 30 }}>
                <h3 style={{ marginTop: 0, marginBottom: 20, fontSize: "1.1rem", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                    {editingTagId ? "Editar Tag" : "Criar Nova Tag"}
                </h3>
                <form onSubmit={handleCreateOrUpdateTag} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                    <div style={{ display: "flex", gap: 15, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 200px" }}>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "#8696a0" }}>Nome da Tag *</label>
                            <input
                                type="text"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                placeholder="Suporte, Vendas, Urgente..."
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "#8696a0" }}>Cor *</label>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <input
                                    type="color"
                                    value={newTagColor}
                                    onChange={(e) => setNewTagColor(e.target.value)}
                                    style={{ width: 44, height: 44, padding: 0, border: "none", background: "none", cursor: "pointer" }}
                                />
                                <input
                                    type="text"
                                    value={newTagColor}
                                    onChange={(e) => setNewTagColor(e.target.value)}
                                    style={{ width: 100, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.85rem", boxSizing: "border-box" }}
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "#8696a0" }}>Descrição (Propósito da tag) *</label>
                        <input
                            type="text"
                            value={newTagDescription}
                            onChange={(e) => setNewTagDescription(e.target.value)}
                            placeholder="Ex: Usada para identificar problemas técnicos urgentes..."
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box" }}
                        />
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                        {editingTagId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="btn btn-ghost"
                                style={{ padding: "11px 20px" }}
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={!newTagName.trim() || !newTagDescription.trim()}
                            className="btn btn-primary"
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px" }}
                        >
                            <Plus size={18} /> {editingTagId ? "Salvar Alterações" : "Adicionar"}
                        </button>
                    </div>
                </form>
            </div>

            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                            <th style={{ textAlign: "left", padding: "15px 20px", color: "#8696a0", fontWeight: 500, fontSize: "0.85rem", width: 60 }}>COR</th>
                            <th style={{ textAlign: "left", padding: "15px 20px", color: "#8696a0", fontWeight: 500, fontSize: "0.85rem", width: 200 }}>NOME</th>
                            <th style={{ textAlign: "left", padding: "15px 20px", color: "#8696a0", fontWeight: 500, fontSize: "0.85rem" }}>DESCRIÇÃO</th>
                            <th style={{ textAlign: "right", padding: "15px 20px", color: "#8696a0", fontWeight: 500, fontSize: "0.85rem", width: 120 }}>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={4} style={{ textAlign: "center", padding: 30, color: "#8696a0" }}>Carregando...</td></tr>
                        )}
                        {!loading && tags.length === 0 && (
                            <tr><td colSpan={4} style={{ textAlign: "center", padding: 30, color: "#8696a0" }}>Nenhuma tag cadastrada.</td></tr>
                        )}
                        {!loading && tags.map(tag => (
                            <tr key={tag.TagId} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "12px 20px" }}>
                                    <div style={{ width: 20, height: 20, borderRadius: 4, background: tag.Color, border: "1px solid rgba(0,0,0,0.1)" }} />
                                </td>
                                <td style={{ padding: "12px 20px" }}>
                                    <span style={{ fontWeight: 500 }}>{tag.Name}</span>
                                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginLeft: 6 }}>
                                        - Utilizada em {tag.UsageCount || 0} registro{(tag.UsageCount === 1) ? "" : "s"}
                                    </span>
                                </td>
                                <td style={{ padding: "12px 20px", color: "var(--text-secondary)", fontSize: "0.9rem" }}>{tag.Description}</td>
                                <td style={{ padding: "12px 20px", textAlign: "right" }}>
                                    <button
                                        onClick={() => handleEditClick(tag)}
                                        style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", opacity: 0.7, marginRight: 15 }}
                                        title="Editar Tag"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTag(tag.TagId)}
                                        style={{ background: "none", border: "none", color: "#ea4335", cursor: "pointer", opacity: 0.7 }}
                                        title="Apagar Tag"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
