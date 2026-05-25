import React, { useState, useEffect } from "react";
import { Plus, Search, Trash2, Edit3, ArrowLeft, Eye, EyeOff, HelpCircle, Check, X, BookOpen, ChevronDown } from "lucide-react";
import DOMPurify from "dompurify";
import { PageHeader } from "./components/PageHeader";
import { api } from "./lib/api";
import type { HelpArticle } from "../../shared/types";
import RichTextEditor from "./components/RichTextEditor";
import { useChat } from "./contexts/ChatContext";
import { parseJwt } from "./lib/auth";

interface Props {
    onBack: () => void;
}

/**
 * Registry of all AltDesk screens that can have contextual help.
 * Each entry maps a ContextKey to a human-readable label, category, and page path.
 */
const SCREEN_REGISTRY = [
    { key: "dashboard.index",    label: "Dashboard Executivo",      category: "Métricas",       path: "/dashboard" },
    { key: "chat.index",         label: "Central de Mensagens",     category: "Atendimento",    path: "/chat" },
    { key: "tickets.index",      label: "Gestão de Chamados",       category: "Atendimento",    path: "/tickets" },
    { key: "contacts.index",     label: "Lista de Contatos",        category: "Geral",          path: "/contacts" },
    { key: "users.index",        label: "Equipe e Colaboradores",   category: "Administração",  path: "/users" },
    { key: "reports.index",      label: "Relatórios Analíticos",    category: "Métricas",       path: "/reports" },
    { key: "settings.index",     label: "Configurações do Sistema", category: "Administração",  path: "/settings" },
    { key: "knowledge.index",    label: "Base de Conhecimento",     category: "Conteúdo",       path: "/knowledge" },
    { key: "queues.index",       label: "Filas de Atendimento",     category: "Administração",  path: "/queues" },
    { key: "tags.index",         label: "Gerenciamento de Tags",    category: "Administração",  path: "/tags" },
    { key: "canned.index",       label: "Respostas Rápidas",        category: "Atendimento",    path: "/canned" },
    { key: "business-hours.index", label: "Horário de Funcionamento", category: "Administração", path: "/business-hours" },
    { key: "billing.index",      label: "Faturamento e Assinatura", category: "Financeiro",     path: "/billing" },
    { key: "audit.index",        label: "Logs de Auditoria",        category: "Administração",  path: "/audit" },
    { key: "help-admin.index",   label: "Gerenciamento de Ajuda",   category: "Administração",  path: "/help-admin" },
];

export function HelpAdmin({ onBack }: Props) {
    const { showToast } = useChat();
    const [articles, setArticles] = useState<HelpArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Editor state
    const [editingArticle, setEditingArticle] = useState<Partial<HelpArticle> & { IsGlobal?: boolean } | null>(null);
    const [viewingArticle, setViewingArticle] = useState<HelpArticle | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // User Role Check
    const token = localStorage.getItem("token") || "";
    const decoded = parseJwt(token);
    const isSuperAdmin = decoded?.role === "SUPERADMIN";

    useEffect(() => {
        loadArticles();
    }, []);

    const loadArticles = async () => {
        setLoading(true);
        try {
            const res = await api.get<HelpArticle[]>("/api/help");
            setArticles(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Erro ao carregar artigos de ajuda:", error);
            showToast("Erro ao carregar os artigos de ajuda.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingArticle?.ContextKey || !editingArticle?.Title || !editingArticle?.Content) {
            showToast("Por favor, preencha todos os campos obrigatórios.", "error");
            return;
        }

        setIsSaving(true);
        try {
            await api.post("/api/help", editingArticle);
            setEditingArticle(null);
            loadArticles();
            showToast("Ajuda contextual salva com sucesso!", "success");
        } catch (error: any) {
            console.error("Erro ao salvar artigo de ajuda:", error);
            showToast("Erro ao salvar: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/api/help/${id}`);
            setConfirmDeleteId(null);
            loadArticles();
            showToast("Ajuda contextual excluída com sucesso!", "success");
        } catch (error: any) {
            console.error("Erro ao excluir artigo de ajuda:", error);
            showToast("Erro ao excluir: " + (error.response?.data?.error || error.message), "error");
        }
    };

    // Determine which screens already have articles
    const existingKeys = new Set(articles.map(a => a.ContextKey));

    const handleScreenSelect = (screenKey: string) => {
        const screen = SCREEN_REGISTRY.find(s => s.key === screenKey);
        if (!screen) return;

        setEditingArticle({
            Title: "",
            Content: "",
            ContextKey: screen.key,
            Category: screen.category,
            PagePath: screen.path,
            IsActive: true,
            IsGlobal: false
        });
    };

    const filteredArticles = articles.filter(a =>
        a.Title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.ContextKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.Category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ─────────────────────────── EDITOR VIEW ───────────────────────────
    if (editingArticle) {
        const selectedScreen = SCREEN_REGISTRY.find(s => s.key === editingArticle.ContextKey);
        const isCustomKey = editingArticle.ContextKey && !SCREEN_REGISTRY.some(s => s.key === editingArticle.ContextKey);

        return (
            <div className="settings-page" style={{ height: "100%", overflowY: "auto", padding: "20px 40px" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
                    <button onClick={() => setEditingArticle(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginRight: 15 }}>
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                            {editingArticle.HelpArticleId 
                                ? "Editar Conteúdo de Ajuda" 
                                : (editingArticle.ContextKey ? "Personalizar Ajuda Padrão (Sobrescrever)" : "Criar Nova Ajuda Contextual")
                            }
                        </h2>
                        {selectedScreen && (
                            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                Tela: <strong style={{ color: "var(--accent)" }}>{selectedScreen.label}</strong> — Rota: <code style={{ fontSize: "0.8rem", background: "var(--bg-hover)", padding: "2px 6px", borderRadius: 4 }}>{selectedScreen.path}</code>
                            </p>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSave} style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 12, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1000, margin: "0 auto" }}>
                    
                    {/* Screen Selector — only for new articles */}
                    {!editingArticle.HelpArticleId && (
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                                Tela do Sistema (selecione uma tela)
                            </label>
                            <div style={{ position: "relative" }}>
                                <select
                                    value={editingArticle.ContextKey || ""}
                                    onChange={e => {
                                        const screen = SCREEN_REGISTRY.find(s => s.key === e.target.value);
                                        if (screen) {
                                            setEditingArticle({
                                                ...editingArticle,
                                                ContextKey: screen.key,
                                                Category: screen.category,
                                                PagePath: screen.path,
                                            });
                                        } else {
                                            setEditingArticle({
                                                ...editingArticle,
                                                ContextKey: e.target.value,
                                            });
                                        }
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "14px 16px",
                                        paddingRight: 40,
                                        borderRadius: 10,
                                        border: "1px solid var(--border)",
                                        background: "var(--bg-primary)",
                                        color: "var(--text-primary)",
                                        fontSize: "0.95rem",
                                        fontWeight: 500,
                                        appearance: "none",
                                        cursor: "pointer"
                                    }}
                                >
                                    <option value="" disabled>— Selecione a tela que receberá ajuda —</option>
                                    {SCREEN_REGISTRY.map(screen => {
                                        const alreadyExists = existingKeys.has(screen.key);
                                        return (
                                            <option
                                                key={screen.key}
                                                value={screen.key}
                                                disabled={alreadyExists && !editingArticle.HelpArticleId}
                                            >
                                                {screen.label} ({screen.path}){alreadyExists ? " ✓ Já possui ajuda" : ""}
                                            </option>
                                        );
                                    })}
                                </select>
                                <ChevronDown 
                                    size={18} 
                                    style={{ 
                                        position: "absolute", 
                                        right: 14, 
                                        top: "50%", 
                                        transform: "translateY(-50%)", 
                                        pointerEvents: "none", 
                                        color: "var(--text-secondary)" 
                                    }} 
                                />
                            </div>
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
                        {/* Context key — read-only if selected from dropdown, editable only when editing existing */}
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Chave de Contexto</label>
                            <input
                                type="text"
                                value={editingArticle.ContextKey || ""}
                                onChange={e => setEditingArticle({ ...editingArticle, ContextKey: e.target.value })}
                                placeholder="Ex: tickets.index"
                                readOnly={!!selectedScreen && !editingArticle.HelpArticleId}
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    borderRadius: 8,
                                    border: "1px solid var(--border)",
                                    background: selectedScreen && !editingArticle.HelpArticleId ? "var(--bg-hover)" : "var(--bg-primary)",
                                    color: "var(--text-primary)",
                                    opacity: selectedScreen && !editingArticle.HelpArticleId ? 0.7 : 1
                                }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Título da Ajuda (Obrigatório)</label>
                            <input
                                type="text"
                                value={editingArticle.Title || ""}
                                onChange={e => setEditingArticle({ ...editingArticle, Title: e.target.value })}
                                placeholder="Ex: Como gerenciar chamados"
                                style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Categoria</label>
                            <input
                                type="text"
                                value={editingArticle.Category || ""}
                                onChange={e => setEditingArticle({ ...editingArticle, Category: e.target.value })}
                                placeholder="Atendimento, Relatórios, etc."
                                style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Caminho da Página (Path URL)</label>
                            <input
                                type="text"
                                value={editingArticle.PagePath || ""}
                                onChange={e => setEditingArticle({ ...editingArticle, PagePath: e.target.value })}
                                placeholder="Ex: /tickets"
                                readOnly={!!selectedScreen && !editingArticle.HelpArticleId}
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    borderRadius: 8,
                                    border: "1px solid var(--border)",
                                    background: selectedScreen && !editingArticle.HelpArticleId ? "var(--bg-hover)" : "var(--bg-primary)",
                                    color: "var(--text-primary)",
                                    opacity: selectedScreen && !editingArticle.HelpArticleId ? 0.7 : 1
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, alignItems: "center" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Status da Ajuda</label>
                            <select
                                value={editingArticle.IsActive ? "active" : "inactive"}
                                onChange={e => setEditingArticle({ ...editingArticle, IsActive: e.target.value === "active" })}
                                style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                            >
                                <option value="active">Ativo (Visível para Agentes)</option>
                                <option value="inactive">Inativo (Rascunho/Oculto)</option>
                            </select>
                        </div>

                        {isSuperAdmin && (
                            <div>
                                <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Escopo do Artigo</label>
                                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={editingArticle.IsGlobal || false}
                                        onChange={e => setEditingArticle({ ...editingArticle, IsGlobal: e.target.checked })}
                                        style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                                    />
                                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Tornar Conteúdo Global (Padrão do Sistema)</span>
                                </label>
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Conteúdo de Suporte (Rich Text)</label>
                        <RichTextEditor
                            content={editingArticle.Content || ""}
                            onChange={content => setEditingArticle({ ...editingArticle, Content: content })}
                            placeholder="Escreva as instruções de uso para esta tela..."
                        />
                    </div>

                    <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                        <button type="button" onClick={() => setEditingArticle(null)} className="btn" style={{ flex: 1, padding: 12, borderRadius: 8, background: "var(--bg-hover)", color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>Cancelar</button>
                        <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ flex: 1, padding: 12, borderRadius: 8, fontWeight: 700, opacity: isSaving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{isSaving ? "Salvando..." : "Salvar Conteúdo"}</button>
                    </div>
                </form>
                <div style={{ height: 40 }} />
            </div>
        );
    }

    // ─────────────────────────── PREVIEW VIEW ───────────────────────────
    if (viewingArticle) {
        return (
            <div className="kb-view" style={{ padding: 20, maxWidth: 900, margin: "0 auto", height: "100%", overflowY: "auto", width: "100%", boxSizing: "border-box" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
                    <button onClick={() => setViewingArticle(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginRight: 15 }} title="Voltar">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: "1.8rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                            {viewingArticle.Title}
                        </h2>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{viewingArticle.Category || "Sem Categoria"}</span>
                            <span>•</span>
                            <span style={{ fontWeight: 600, color: viewingArticle.TenantId ? "var(--accent)" : "#9b59b6" }}>
                                {viewingArticle.TenantId ? "Artigo Customizado (Tenant)" : "Artigo Global (Sistema)"}
                            </span>
                            <span>•</span>
                            <span>Chave: <code style={{ background: "var(--bg-hover)", padding: "2px 6px", borderRadius: 4, fontSize: "0.8rem" }}>{viewingArticle.ContextKey}</code></span>
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

    // ─────────────────────────── LIST VIEW ───────────────────────────
    // Screens that don't have articles yet
    const missingScreens = SCREEN_REGISTRY.filter(s => !existingKeys.has(s.key));

    return (
        <div className="settings-page" style={{ height: "100%", overflowY: "auto" }}>
            <PageHeader
                title="Gerenciamento do Sistema de Ajuda"
                icon={HelpCircle}
                onBack={onBack}
                helpText={
                    <div>
                        <p>Esta interface administrativa gerencia os textos exibidos no Painel Lateral Deslizante (Help Drawer) de cada tela.</p>
                        <ul style={{ marginTop: 12, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                            <li><strong>Chave de Contexto:</strong> Mapeia qual tela acionará a ajuda (ex: <code>tickets.index</code>).</li>
                            <li><strong>Sobrescrita por Empresa:</strong> Artigos globais servem de fallback. Se você criar um artigo no seu Tenant com a mesma chave, a versão customizada será exibida aos seus operadores.</li>
                        </ul>
                    </div>
                }
                actionNode={
                    <button onClick={() => setEditingArticle({ Title: "", Content: "", Category: "", ContextKey: "", IsActive: true, IsGlobal: false })} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Plus size={18} /> Nova Ajuda Contextual
                    </button>
                }
            />

            {/* Quick-create cards for screens without help */}
            {missingScreens.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                    <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                        Telas sem Conteúdo de Ajuda ({missingScreens.length})
                    </h3>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {missingScreens.map(screen => (
                            <button
                                key={screen.key}
                                onClick={() => handleScreenSelect(screen.key)}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: 8,
                                    border: "1px dashed var(--border)",
                                    background: "transparent",
                                    color: "var(--text-secondary)",
                                    fontSize: "0.82rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    transition: "all 0.2s"
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = "var(--accent)";
                                    e.currentTarget.style.color = "var(--accent)";
                                    e.currentTarget.style.background = "rgba(0,168,132,0.05)";
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = "var(--border)";
                                    e.currentTarget.style.color = "var(--text-secondary)";
                                    e.currentTarget.style.background = "transparent";
                                }}
                            >
                                <Plus size={14} />
                                {screen.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ position: "relative", marginBottom: 25 }}>
                <Search size={18} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                <input
                    type="text"
                    placeholder="Buscar ajudas por título, categoria ou chave de contexto..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: "100%", padding: "12px 12px 12px 45px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                {loading && <div style={{ textAlign: "center", padding: 40, width: "100%", gridColumn: "1 / -1" }}>Carregando artigos de ajuda...</div>}
                {!loading && filteredArticles.length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, gridColumn: "1 / -1", color: "var(--text-secondary)" }}>
                        Nenhuma ajuda cadastrada encontrada.
                    </div>
                )}
                {!loading && filteredArticles.map(article => {
                    const screenInfo = SCREEN_REGISTRY.find(s => s.key === article.ContextKey);
                    return (
                        <div key={article.HelpArticleId} style={{
                            background: "var(--bg-secondary)",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            padding: 20,
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            transition: "all 0.2s",
                            cursor: "default"
                        }}
                        className="card-hover"
                        >
                            {/* Top bar */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                                    {article.IsActive ? (
                                        <span title="Ativo" style={{ display: "flex" }}><Eye size={14} color="#00a884" /></span>
                                    ) : (
                                        <span title="Inativo / Oculto" style={{ display: "flex" }}><EyeOff size={14} color="var(--text-secondary)" /></span>
                                    )}
                                    <span style={{
                                        fontSize: "0.65rem",
                                        textTransform: "uppercase",
                                        padding: "2px 8px",
                                        borderRadius: 4,
                                        background: article.TenantId ? "rgba(0, 168, 132, 0.12)" : "rgba(155, 89, 182, 0.12)",
                                        color: article.TenantId ? "var(--accent)" : "#9b59b6",
                                        fontWeight: 700
                                    }}>
                                        {article.TenantId ? "Customizado" : "Global"}
                                    </span>
                                    {article.Category && (
                                        <span style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600 }}>
                                            {article.Category}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    {confirmDeleteId === article.HelpArticleId ? (
                                        <>
                                            <button onClick={() => handleDelete(article.HelpArticleId)} style={{ background: "var(--danger)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }} title="Confirmar">
                                                <Check size={14} /> Sim
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(null)} style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "4px 8px", borderRadius: 4 }} title="Cancelar">
                                                <X size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => setViewingArticle(article)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }} title="Visualizar">
                                                <BookOpen size={16} />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (!isSuperAdmin && !article.TenantId) {
                                                        // Se não for SuperAdmin e o artigo for global, edita como personalização/cópia
                                                        setEditingArticle({
                                                            ...article,
                                                            HelpArticleId: undefined, // Limpa para criar no tenant
                                                            TenantId: decoded?.tenantId || null,
                                                            IsGlobal: false
                                                        });
                                                    } else {
                                                        setEditingArticle({
                                                            ...article,
                                                            IsGlobal: !article.TenantId
                                                        });
                                                    }
                                                }} 
                                                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }} 
                                                title={(!isSuperAdmin && !article.TenantId) ? "Personalizar Ajuda" : "Editar"}
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            {(!article.TenantId && !isSuperAdmin) ? null : (
                                                <button onClick={() => setConfirmDeleteId(article.HelpArticleId)} style={{ background: "none", border: "none", color: "#ea4335", cursor: "pointer", padding: 4 }} title="Excluir">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Title + screen label */}
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{article.Title}</h3>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                                    <code style={{ background: "var(--bg-hover)", padding: "1px 6px", borderRadius: 4 }}>{article.ContextKey}</code>
                                    {screenInfo && (
                                        <span style={{ opacity: 0.8 }}>→ {screenInfo.label}</span>
                                    )}
                                </div>
                            </div>

                            {/* Content preview */}
                            <div
                                style={{
                                    margin: 0,
                                    fontSize: "0.82rem",
                                    color: "var(--text-secondary)",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    lineHeight: 1.5
                                }}
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.Content) }}
                            />

                            {/* Footer */}
                            <div style={{ marginTop: "auto", fontSize: "0.72rem", color: "var(--text-secondary)", opacity: 0.7 }}>
                                Atualizado em {new Date(article.UpdatedAt || "").toLocaleDateString("pt-BR")}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
