import { useState, useEffect } from "react";
import { Search, Plus, MessageSquare, Edit2, Trash2, ArrowLeft, User, Phone, Mail } from "lucide-react";

type Contact = {
    ContactId: string;
    Name: string;
    Phone: string;
    Email?: string;
    Tags?: string[];
    Notes?: string;
};

import { api } from "./lib/api";

export function Contacts({ onBack, onStartChat }: { onBack: () => void, onStartChat: (c: any) => void }) {
    const [items, setItems] = useState<Contact[]>([]);
    const [search, setSearch] = useState("");
    const [view, setView] = useState<"LIST" | "EDIT">("LIST");
    const [editing, setEditing] = useState<Partial<Contact>>({});


    useEffect(() => {
        loadContacts();
    }, [search]);

    function loadContacts() {
        let url = "/api/contacts";
        const params = search ? { search } : {};
        api.get(url, { params })
            .then((res) => {
                if (Array.isArray(res.data)) {
                    setItems(res.data);
                } else {
                    console.error("API returned non-array for contacts:", res.data);
                    setItems([]);
                }
            })
            .catch(err => {
                console.error(err);
                setItems([]);
            });
    }

    const handleSave = async () => {
        if (!editing.Name || !editing.Phone) return alert("Nome e Telefone obrigatórios");

        try {
            const method = editing.ContactId ? "put" : "post";
            const url = editing.ContactId
                ? `/api/contacts/${editing.ContactId}`
                : `/api/contacts`;

            await api[method](url, {
                name: editing.Name,
                phone: editing.Phone,
                email: editing.Email,
                notes: editing.Notes,
                tags: editing.Tags
            });

            setView("LIST");
            setEditing({});
            loadContacts();
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message;
            alert("Erro ao salvar: " + errorMsg);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Deletar contato?")) return;
        try {
            await api.delete(`/api/contacts/${id}`);
            setItems(items.filter(i => i.ContactId !== id));
        } catch (err: any) {
            console.error(err);
        }
    };

    return (
        <div className="main-area" style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-primary)", height: "100%" }}>
            <div className="chat-header">
                <div className="info" style={{ display: "flex", alignItems: "center", gap: 15 }}>
                    {view === "LIST" ? (
                        <>
                            <button onClick={onBack} className="icon-btn" title="Voltar"><ArrowLeft size={20} /></button>
                            <h2>Contatos</h2>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setView("LIST")} className="icon-btn" title="Voltar"><ArrowLeft size={20} /></button>
                            <h2>{editing.ContactId ? "Editar Contato" : "Novo Contato"}</h2>
                        </>
                    )}
                </div>
                {view === "LIST" && (
                    <button className="btn btn-primary" onClick={() => { setEditing({}); setView("EDIT"); }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Plus size={16} /> Novo Contato
                    </button>
                )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                {view === "LIST" && (
                    <div style={{ maxWidth: 800, margin: "0 auto" }}>
                        <div className="search-box" style={{ padding: "0 0 20px 0" }}>
                            <div style={{ position: "relative" }}>
                                <Search size={18} style={{ position: "absolute", left: 14, top: 11, color: "var(--text-secondary)" }} />
                                <input
                                    placeholder="Buscar contatos..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ paddingLeft: 40 }}
                                />
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {items.length === 0 && (
                                <div className="empty-state" style={{ marginTop: 40 }}>
                                    <User size={48} opacity={0.5} />
                                    <p>Nenhum contato encontrado.</p>
                                </div>
                            )}
                            {items.map(c => (
                                <div key={c.ContactId} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", padding: 16, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", transition: "transform 0.2s, box-shadow 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0, 168, 132, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>{c.Name}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 15, marginTop: 4 }}>
                                                <span style={{ fontSize: "13px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {c.Phone}</span>
                                                {c.Email && <span style={{ fontSize: "13px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><Mail size={12} /> {c.Email}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={() => onStartChat(c)} className="btn btn-ghost" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }} title="Enviar Mensagem">
                                            <MessageSquare size={16} /> Chat
                                        </button>
                                        <button onClick={() => { setEditing(c); setView("EDIT"); }} className="icon-btn" style={{ padding: 8 }} title="Editar">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(c.ContactId)} className="icon-btn" style={{ padding: 8, color: "var(--danger)" }} title="Excluir">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === "EDIT" && (
                    <div className="login-card" style={{ margin: "40px auto", width: "100%", maxWidth: 500 }}>
                        <h1 style={{ marginBottom: 20 }}>{editing.ContactId ? "Editar Contato" : "Novo Contato"}</h1>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div className="field">
                                <label>Nome Completo</label>
                                <input placeholder="Ex: João Silva" value={editing.Name || ""} onChange={e => setEditing({ ...editing, Name: e.target.value })} />
                            </div>
                            <div className="field">
                                <label>Telefone (WhatsApp)</label>
                                <input placeholder="Ex: 5511999999999" value={editing.Phone || ""} onChange={e => setEditing({ ...editing, Phone: e.target.value })} />
                            </div>
                            <div className="field">
                                <label>Email (Opcional)</label>
                                <input type="email" placeholder="Ex: joao@email.com" value={editing.Email || ""} onChange={e => setEditing({ ...editing, Email: e.target.value })} />
                            </div>
                            <div className="field">
                                <label>Anotações (Opcional)</label>
                                <textarea
                                    placeholder="Observações sobre o contato..."
                                    value={editing.Notes || ""}
                                    onChange={e => setEditing({ ...editing, Notes: e.target.value })}
                                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", resize: "vertical", minHeight: 100 }}
                                />
                            </div>

                            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                                <button onClick={() => setView("LIST")} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                                <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }}>{editing.ContactId ? "Salvar Alterações" : "Criar Contato"}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
