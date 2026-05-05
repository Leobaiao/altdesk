import React, { useState, useEffect } from "react";
import { Plus, Search, MessageSquare, Zap, Trash2, ArrowLeft, Pencil, Check, X } from "lucide-react";


import { PageHeader } from "./components/PageHeader";

import type { CannedResponse } from "../../shared/types";

import { api } from "./lib/api";

export function CannedResponses({ onBack }: { onBack: () => void }) {
    const [items, setItems] = useState<CannedResponse[]>([]);
    const [view, setView] = useState<"LIST" | "FORM">("LIST");
    const [editingItem, setEditingItem] = useState<CannedResponse | null>(null);
    const [newShortcut, setNewShortcut] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newTitle, setNewTitle] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);


    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            const res = await api.get<CannedResponse[]>("/api/canned-responses");
            if (Array.isArray(res.data)) {
                setItems(res.data);
            } else {
                setItems([]);
            }
        } catch (e) {
            console.error(e);
            setItems([]);
        }
    };

    const handleSave = async () => {
        if (!newShortcut || !newContent || !newTitle) return alert("Preencha todos os campos");

        try {
            if (editingItem) {
                await api.put(`/api/canned-responses/${editingItem.CannedResponseId}`, {
                    shortcut: newShortcut,
                    content: newContent,
                    title: newTitle
                });
            } else {
                await api.post("/api/canned-responses", {
                    shortcut: newShortcut,
                    content: newContent,
                    title: newTitle
                });
            }

            await loadItems();
            setView("LIST");
            resetForm();
        } catch (error: any) {
            const err = error.response?.data || {};
            alert("Erro ao salvar: " + (err.error || error.message));
        }
    };

    const resetForm = () => {
        setEditingItem(null);
        setNewShortcut("");
        setNewContent("");
        setNewTitle("");
    };

    const handleEdit = (item: CannedResponse) => {
        setEditingItem(item);
        setNewShortcut(item.Shortcut);
        setNewContent(item.Content);
        setNewTitle(item.Title);
        setView("FORM");
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/api/canned-responses/${id}`);
            setItems(prev => prev.filter(i => i.CannedResponseId !== id));
            setConfirmDeleteId(null);
        } catch (e: any) {
            console.error("Delete failed:", e);
            alert("Erro ao excluir: " + (e.response?.data?.error || e.message));
        }
    };




    return (
        <div className="settings-page" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
            <PageHeader
                title={view === "LIST" ? "Respostas Rápidas" : (editingItem ? "Editar Resposta Rápida" : "Nova Resposta Rápida")}
                icon={BookOpen}
                onBack={view === "LIST" ? onBack : () => { setView("LIST"); resetForm(); }}
                helpText={
                    <div>
                        <p>Respostas rápidas são modelos de texto pré-configurados para agilizar o atendimento.</p>
                        <ul style={{ marginTop: 12, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                            <li><strong>Uso no Chat:</strong> No campo de digitação do chat, digite <strong>"/"</strong> seguido pelo atalho (ex: /oi) para carregar o texto.</li>
                            <li><strong>Sincronização:</strong> Todos os atendentes da sua empresa podem utilizar as mesmas respostas padrão.</li>
                            <li><strong>Produtividade:</strong> Evite redigitar frases comuns e mantenha um tom de voz consistente.</li>
                        </ul>
                    </div>
                }
                actionNode={view === "LIST" ? (
                    <button className="btn btn-primary" onClick={() => { setView("FORM"); resetForm(); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12 }}>
                        <Plus size={18} /> Nova
                    </button>
                ) : undefined}
            />

            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                {view === "LIST" && (
                    <div style={{ maxWidth: 800, margin: "0 auto" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {items.length === 0 && (
                                <div className="empty-state" style={{ marginTop: 40 }}>
                                    <MessageSquare size={48} opacity={0.5} />
                                    <p>Nenhuma resposta rápida cadastrada.</p>
                                </div>
                            )}
                            {items.map((item) => (
                                <div key={item.CannedResponseId} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", padding: 16, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", transition: "transform 0.2s, box-shadow 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0, 168, 132, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                                            <Zap size={24} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>
                                                <span style={{ color: "var(--accent)", marginRight: 4 }}>/</span>{item.Shortcut} - {item.Title}
                                            </div>
                                            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: 4, whiteSpace: "pre-wrap" }}>{item.Content}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {confirmDeleteId === item.CannedResponseId ? (
                                            <>
                                                <button onClick={() => handleDelete(item.CannedResponseId)} className="icon-btn" style={{ padding: "10px 16px", background: "var(--danger)", borderRadius: 8, color: "#fff", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}>
                                                    <Check size={16} /> Confirmar
                                                </button>
                                                <button onClick={() => setConfirmDeleteId(null)} className="icon-btn" style={{ padding: 10, background: "var(--bg-hover)", borderRadius: 8, color: "var(--text-secondary)" }}>
                                                    <X size={18} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleEdit(item)} className="icon-btn" style={{ padding: 10, background: "rgba(0,168,132,0.1)", borderRadius: 8, color: "var(--accent)" }} title="Editar">
                                                    <Pencil size={18} />
                                                </button>
                                                <button onClick={() => setConfirmDeleteId(item.CannedResponseId)} className="icon-btn" style={{ padding: 10, background: "rgba(234,67,53,0.1)", borderRadius: 8, color: "var(--danger)" }} title="Excluir">
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === "FORM" && (
                    <div className="login-card" style={{ margin: "40px auto", width: "100%", maxWidth: 500 }}>
                        <h1 style={{ marginBottom: 20 }}>{editingItem ? "Editar Resposta" : "Nova Resposta Rápida"}</h1>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div className="field">
                                <label>Título (ex: Saudação)</label>
                                <input placeholder="Um nome pra identificar a mensagem..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Atalho (ex: oi)</label>
                                <div style={{ position: "relative" }}>
                                    <span style={{ position: "absolute", left: 14, top: 12, color: "var(--text-secondary)" }}>/</span>
                                    <input placeholder="A palavra chave..." value={newShortcut} onChange={(e) => setNewShortcut(e.target.value)} style={{ paddingLeft: 24 }} />
                                </div>
                            </div>
                            <div className="field">
                                <label>Conteúdo da mensagem</label>
                                <textarea
                                    placeholder="O texto que será enviado..."
                                    value={newContent}
                                    onChange={(e) => setNewContent(e.target.value)}
                                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", resize: "vertical", minHeight: 120 }}
                                />
                            </div>

                            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                                <button type="button" onClick={() => { setView("LIST"); resetForm(); }} className="btn" style={{ flex: 1, height: "48px", borderRadius: 12, background: "var(--bg-hover)", color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>Cancelar</button>
                                <button type="button" onClick={handleSave} className="btn btn-primary" style={{ flex: 1, height: "48px", borderRadius: 12, fontWeight: 700, boxShadow: "0 4px 12px rgba(0, 168, 132, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>{editingItem ? "Atualizar" : "Salvar"} Resposta</button>
                            </div>



                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
