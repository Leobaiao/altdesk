import React, { useState, useEffect } from "react";
import { Plus, Search, Trash2, Edit3, ArrowLeft, Eye, EyeOff, BookOpen } from "lucide-react";
import DOMPurify from "dompurify";
import { api } from "./lib/api";
import type { KnowledgeArticle } from "../../shared/types";
import RichTextEditor from "./components/RichTextEditor";

interface Props {
    onBack: () => void;
}

export function KnowledgeBase({ onBack }: Props) {
    const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Editor state
    const [editingArticle, setEditingArticle] = useState<Partial<KnowledgeArticle> | null>(null);
    const [viewingArticle, setViewingArticle] = useState<KnowledgeArticle | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadArticles();
    }, []);

    const loadArticles = async () => {
        setLoading(true);
        try {
            const res = await api.get<KnowledgeArticle[]>("/api/knowledge");
            setArticles(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Erro ao carregar artigos:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingArticle?.Title || !editingArticle?.Content) return;

        setIsSaving(true);
        try {
            if (editingArticle.ArticleId) {
                await api.put(`/api/knowledge/${editingArticle.ArticleId}`, editingArticle);
            } else {
                await api.post("/api/knowledge", editingArticle);
            }
            setEditingArticle(null);
            loadArticles();
        } catch (error) {
            console.error("Erro ao salvar artigo:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este artigo?")) return;
        try {
            await api.delete(`/api/knowledge/${id}`);
            loadArticles();
        } catch (error) {
            console.error("Erro ao excluir artigo:", error);
        }
    };

    const filteredArticles = articles.filter(a =>
        a.Title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.Category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (editingArticle) {
        return (
            <div className="kb-editor" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
                    <button onClick={() => setEditingArticle(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginRight: 15 }}>
                        <ArrowLeft size={24} />
                    </button>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                        {editingArticle.ArticleId ? "Editar Artigo" : "Novo Artigo"}
                    </h2>
                </div>

                <form onSubmit={handleSave} style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 12, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "#8696a0" }}>Título</label>
                        <input
                            type="text"
                            value={editingArticle.Title || ""}
                            onChange={e => setEditingArticle({ ...editingArticle, Title: e.target.value })}
                            placeholder="Ex: Como realizar um estorno"
                            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                            required
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "#8696a0" }}>Categoria</label>
                            <input
                                type="text"
                                value={editingArticle.Category || ""}
                                onChange={e => setEditingArticle({ ...editingArticle, Category: e.target.value })}
                                placeholder="Financeiro, Suporte, etc."
                                style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "#8696a0" }}>Visibilidade</label>
                            <select
                                value={editingArticle.IsPublic ? "public" : "private"}
                                onChange={e => setEditingArticle({ ...editingArticle, IsPublic: e.target.value === "public" })}
                                style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                            >
                                <option value="public">Público (Visível no Widget)</option>
                                <option value="private">Privado (Apenas Agentes)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "#8696a0" }}>Conteúdo</label>
                        <RichTextEditor
                            content={editingArticle.Content || ""}
                            onChange={content => setEditingArticle({ ...editingArticle, Content: content })}
                            placeholder="Escreva o conteúdo do artigo aqui..."
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 15, marginTop: 10 }}>
                        <button type="button" onClick={() => setEditingArticle(null)} style={{ padding: "12px 24px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-primary)", cursor: "pointer" }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ padding: "12px 32px", borderRadius: 8, fontWeight: 600 }}>
                            {isSaving ? "Salvando..." : "Salvar Artigo"}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    if (viewingArticle) {
        return (
            <div className="kb-view" style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
                    <button onClick={() => setViewingArticle(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginRight: 15 }} title="Voltar">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: "1.8rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                            {viewingArticle.Title}
                        </h2>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 6, display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{viewingArticle.Category || "Sem Categoria"}</span>
                            <span>•</span>
                            <span>Atualizado em {new Date(viewingArticle.UpdatedAt || "").toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="article-content-box" style={{ background: "var(--bg-secondary)", padding: "40px", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", minHeight: 400 }}>
                    <div 
                        className="tiptap"
                        style={{ color: "var(--text-primary)", lineHeight: "1.7", fontSize: "1.05rem" }}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewingArticle.Content) }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="kb-page" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginRight: 15 }}>
                        <ArrowLeft size={24} />
                    </button>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Base de Conhecimento</h2>
                </div>
                <button onClick={() => setEditingArticle({ Title: "", Content: "", Category: "", IsPublic: true })} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Plus size={18} /> Novo Artigo
                </button>
            </div>

            <div style={{ position: "relative", marginBottom: 25 }}>
                <Search size={18} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "#8696a0" }} />
                <input
                    type="text"
                    placeholder="Buscar artigos por título ou categoria..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: "100%", padding: "12px 12px 12px 45px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                {loading && <div style={{ textAlign: "center", padding: 40, width: "100%" }}>Carregando artigos...</div>}
                {!loading && filteredArticles.length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, gridColumn: "1 / -1", color: "#8696a0" }}>
                        Nenhum artigo encontrado.
                    </div>
                )}
                {!loading && filteredArticles.map(article => (
                    <div key={article.ArticleId} style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", padding: 20, display: "flex", flexDirection: "column", gap: 15 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {article.IsPublic ? (
                                    <span title="Público"><Eye size={16} color="#00a884" /></span>
                                ) : (
                                    <span title="Privado"><EyeOff size={16} color="#8696a0" /></span>
                                )}
                                <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 1, color: "#8696a0", fontWeight: 600 }}>
                                    {article.Category || "Sem Categoria"}
                                </span>
                            </div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={() => setViewingArticle(article)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer" }} title="Visualizar">
                                    <BookOpen size={18} />
                                </button>
                                <button onClick={() => setEditingArticle(article)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }} title="Editar">
                                    <Edit3 size={18} />
                                </button>
                                <button onClick={() => handleDelete(article.ArticleId)} style={{ background: "none", border: "none", color: "#ea4335", cursor: "pointer" }} title="Excluir">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>{article.Title}</h3>
                        <div 
                            style={{ 
                                margin: 0, 
                                fontSize: "0.85rem", 
                                color: "var(--text-secondary)", 
                                display: "-webkit-box", 
                                WebkitLineClamp: 3, 
                                WebkitBoxOrient: "vertical", 
                                overflow: "hidden" 
                            }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.Content) }}
                        />
                        <div style={{ marginTop: "auto", fontSize: "0.75rem", color: "#8696a0" }}>
                            Última atualização: {new Date(article.UpdatedAt || "").toLocaleDateString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
