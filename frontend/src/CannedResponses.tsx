import { useState, useEffect } from "react";
import { Plus, Trash2, ArrowLeft, MessageSquare, Zap } from "lucide-react";

import type { CannedResponse } from "../../shared/types";

import { api } from "./lib/api";

export function CannedResponses({ onBack }: { onBack: () => void }) {
    const [items, setItems] = useState<CannedResponse[]>([]);
    const [view, setView] = useState<"LIST" | "NEW">("LIST");
    const [newShortcut, setNewShortcut] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newTitle, setNewTitle] = useState("");

    useEffect(() => {
        api.get<CannedResponse[]>("/api/canned-responses")
            .then((res) => {
                if (Array.isArray(res.data)) {
                    setItems(res.data);
                } else {
                    console.error("API returned non-array for canned responses:", res.data);
                    setItems([]);
                }
            })
            .catch(console.error);
    }, []);

    const handleSave = async () => {
        if (!newShortcut || !newContent || !newTitle) return alert("Preencha todos os campos");

        try {
            await api.post("/api/canned-responses", { shortcut: newShortcut, content: newContent, title: newTitle });

            // reload
            const listRes = await api.get<CannedResponse[]>("/api/canned-responses");
            if (Array.isArray(listRes.data)) {
                setItems(listRes.data);
            }
            setView("LIST");
            setNewShortcut("");
            setNewContent("");
            setNewTitle("");
        } catch (error: any) {
            const err = error.response?.data || {};
            alert("Erro ao salvar: " + (err.error || error.message));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Deletar?")) return;
        try {
            await api.delete(`/api/canned-responses/${id}`);
            setItems(items.filter((i) => i.CannedResponseId !== id));
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="main-area" style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-primary)", height: "100%" }}>
            <div className="chat-header">
                <div className="info" style={{ display: "flex", alignItems: "center", gap: 15 }}>
                    {view === "LIST" ? (
                        <>
                            <button onClick={onBack} className="icon-btn" title="Voltar"><ArrowLeft size={20} /></button>
                            <h2>Respostas Rápidas</h2>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setView("LIST")} className="icon-btn" title="Voltar"><ArrowLeft size={20} /></button>
                            <h2>Nova Resposta Rápida</h2>
                        </>
                    )}
                </div>
                {view === "LIST" && (
                    <button className="btn btn-primary" onClick={() => setView("NEW")} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Plus size={16} /> Nova Resposta Rápida
                    </button>
                )}
            </div>

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
                                    <div>
                                        <button onClick={() => handleDelete(item.CannedResponseId)} className="icon-btn" style={{ padding: 8, color: "var(--danger)" }} title="Excluir">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === "NEW" && (
                    <div className="login-card" style={{ margin: "40px auto", width: "100%", maxWidth: 500 }}>
                        <h1 style={{ marginBottom: 20 }}>Nova Resposta Rápida</h1>
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

                            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                                <button onClick={() => setView("LIST")} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                                <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }}>Salvar Resposta Rápida</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
