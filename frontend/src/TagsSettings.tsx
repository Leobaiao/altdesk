import React, { useState, useEffect } from "react";
import { Plus, Trash2, Tag as TagIcon } from "lucide-react";
import { PageHeader } from "./components/PageHeader";
import { api } from "./lib/api";
import type { Tag } from "../../shared/types";

interface Props {
    onBack: () => void;
}

export function TagsSettings({ onBack }: Props) {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#00a884");

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

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagName.trim()) return;

        try {
            await api.post("/api/tags", { name: newTagName, color: newTagColor });
            setNewTagName("");
            setNewTagColor("#00a884");
            loadTags();
        } catch (error) {
            console.error("Erro ao criar tag:", error);
        }
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
                title="Gerenciar Tags"
                icon={TagIcon}
                onBack={onBack}
            />

            <div style={{ background: "var(--bg-secondary)", padding: 25, borderRadius: 12, border: "1px solid var(--border)", marginBottom: 30 }}>
                <h3 style={{ marginTop: 0, marginBottom: 20, fontSize: "1.1rem", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>Criar Nova Tag</h3>
                <form onSubmit={handleCreateTag} style={{ display: "flex", gap: 15, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 150px" }}>
                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "#8696a0" }}>Nome da Tag</label>
                        <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="Suporte, Vendas, Urgente..."
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                        />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "#8696a0" }}>Cor</label>
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
                                style={{ width: 100, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.85rem" }}
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!newTagName.trim()}
                        className="btn btn-primary"
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px" }}
                    >
                        <Plus size={18} /> Adicionar
                    </button>
                </form>
            </div>

            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                            <th style={{ textAlign: "left", padding: "15px 20px", color: "#8696a0", fontWeight: 500, fontSize: "0.85rem" }}>COR</th>
                            <th style={{ textAlign: "left", padding: "15px 20px", color: "#8696a0", fontWeight: 500, fontSize: "0.85rem" }}>NOME</th>
                            <th style={{ textAlign: "right", padding: "15px 20px", color: "#8696a0", fontWeight: 500, fontSize: "0.85rem" }}>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={3} style={{ textAlign: "center", padding: 30, color: "#8696a0" }}>Carregando...</td></tr>
                        )}
                        {!loading && tags.length === 0 && (
                            <tr><td colSpan={3} style={{ textAlign: "center", padding: 30, color: "#8696a0" }}>Nenhuma tag cadastrada.</td></tr>
                        )}
                        {!loading && tags.map(tag => (
                            <tr key={tag.TagId} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "12px 20px" }}>
                                    <div style={{ width: 20, height: 20, borderRadius: 4, background: tag.Color, border: "1px solid rgba(0,0,0,0.1)" }} />
                                </td>
                                <td style={{ padding: "12px 20px", fontWeight: 500 }}>{tag.Name}</td>
                                <td style={{ padding: "12px 20px", textAlign: "right" }}>
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
