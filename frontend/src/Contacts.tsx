import { useState, useEffect } from "react";
import { Search, Plus, MessageSquare, Edit2, Trash2, ArrowLeft, User, Phone, Mail, Contact as ContactsIcon } from "lucide-react";
import { PageHeader } from "./components/PageHeader";
import { PhoneMaskInput } from "./components/PhoneMaskInput";

type Contact = {
    ContactId: string;
    Name: string;
    Phone: string;
    Email?: string;
    Tags?: string[];
    Notes?: string;
    Source?: string;
    ChannelType?: string;
    Campaign?: string;
    LastActivityAt?: string;
};

import { api } from "./lib/api";
import { useChat } from "./contexts/ChatContext";

export function Contacts({ onBack, onStartChat }: { onBack: () => void, onStartChat: (c: any) => void }) {
    const { showToast } = useChat();
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
        if (!editing.Name || !editing.Phone) {
            showToast("Nome e Telefone obrigatórios", "error");
            return;
        }

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
                tags: editing.Tags,
                source: editing.Source,
                channelType: editing.ChannelType,
                campaign: editing.Campaign
            });

            setView("LIST");
            setEditing({});
            loadContacts();
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message;
            showToast("Erro ao salvar: " + errorMsg, "error");
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
        <div className="settings-page" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
            <PageHeader
                title={view === "LIST" ? "Contatos" : editing.ContactId ? "Editar Contato" : "Novo Contato"}
                icon={ContactsIcon}
                onBack={view === "LIST" ? onBack : () => setView("LIST")}
                contextKey="contacts.index"
                helpText={
                    <div>
                        <p>Esta tela permite o gerenciamento centralizado de seus contatos e clientes.</p>
                        <ul style={{ marginTop: 12, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                            <li><strong>Gestão:</strong> Crie, edite e organize informações de contato.</li>
                            <li><strong>Início Rápido:</strong> Use o botão "Chat" para abrir uma conversa imediatamente.</li>
                            <li><strong>Busca:</strong> Localize qualquer cliente pelo nome ou número de telefone.</li>
                            <li><strong>Notas:</strong> Salve observações importantes para consultas futuras no atendimento.</li>
                        </ul>
                    </div>
                }
                actionNode={view === "LIST" ? (
                    <button className="btn btn-primary" onClick={() => { setEditing({}); setView("EDIT"); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12 }}>
                        <Plus size={18} /> Novo Contato
                    </button>
                ) : undefined}
            />

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
                                                {c.LastActivityAt && <span style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 6 }}>Ativo em: {new Date(c.LastActivityAt).toLocaleDateString()}</span>}
                                            </div>
                                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                                                {c.Source && (
                                                    <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 6, background: "rgba(99,102,241,0.1)", color: "#6366f1", fontWeight: 700 }}>
                                                        📍 {c.Source}
                                                    </span>
                                                )}
                                                {c.ChannelType && (
                                                    <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 6, background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 700 }}>
                                                        📱 {c.ChannelType}
                                                    </span>
                                                )}
                                                {c.Campaign && (
                                                    <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 6, background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 700 }}>
                                                        🏷️ {c.Campaign}
                                                    </span>
                                                )}
                                                {c.LastActivityAt && (
                                                    <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3, opacity: 0.7 }}>
                                                        🕐 {new Date(c.LastActivityAt).toLocaleDateString('pt-BR')} {new Date(c.LastActivityAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
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
                            <PhoneMaskInput 
                                label="Telefone (WhatsApp)" 
                                placeholder="(11) 99999-0000" 
                                value={editing.Phone || ""} 
                                onChange={e => setEditing({ ...editing, Phone: e.target.value })} 
                            />
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
                                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", resize: "vertical", minHeight: 80 }}
                                />
                            </div>

                            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Rastreamento CRM</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <div className="field">
                                        <label>Origem</label>
                                        <input placeholder="Ex: Google, Instagram, Indicação" value={(editing as any).Source || ""} onChange={e => setEditing({ ...editing, Source: e.target.value } as any)} />
                                    </div>
                                    <div className="field">
                                        <label>Tipo de Canal</label>
                                        <select
                                            value={(editing as any).ChannelType || ""}
                                            onChange={e => setEditing({ ...editing, ChannelType: e.target.value } as any)}
                                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="Whatsapp">Whatsapp</option>
                                            <option value="Email">Email</option>
                                            <option value="Web">Web</option>
                                            <option value="Telefone">Telefone</option>
                                            <option value="Presencial">Presencial</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="field" style={{ marginTop: 12 }}>
                                    <label>Campanha / UTM</label>
                                    <input placeholder="Ex: campanha_maio_2026" value={(editing as any).Campaign || ""} onChange={e => setEditing({ ...editing, Campaign: e.target.value } as any)} />
                                </div>
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
