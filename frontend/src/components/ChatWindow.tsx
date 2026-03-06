import React, { useState, useRef, useEffect, useMemo } from "react";
import { MessageCircleOff, ArrowLeft, Trash2, CheckCircle, RotateCcw, Users as UsersIcon, Zap, ChevronDown, Smile, FileText, Send, UserPlus } from "lucide-react";
import { useChat } from "../contexts/ChatContext";
import { AudioPlayer } from "./AudioPlayer";
import { EmojiPicker } from "./EmojiPicker";
import { TemplateModal } from "./TemplateModal";
import { ImageViewerModal } from "./ImageViewerModal";
import { DocumentCard } from "./DocumentCard";

import { api } from "../lib/api";

function formatTime(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatPhone(ext: string) {
    if (!ext) return "";
    return ext.replace("@s.whatsapp.net", "");
}

// Helper para descobrir o UserId a partir do token
function getUserIdFromToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.userId;
    } catch {
        return null;
    }
}


export function ChatWindow({ setView, showToast }: { setView: (v: any) => void, showToast: (m: string, t: "success" | "error" | "info") => void }) {
    const { conversations, selectedConversationId, setSelectedConversationId, messages, refreshConversations } = useChat();
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [showScrollButton, setShowScrollButton] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Canned Responses
    const [cannedResponses, setCannedResponses] = useState<any[]>([]);
    const [showCannedMenu, setShowCannedMenu] = useState(false);
    const [cannedFilter, setCannedFilter] = useState("");

    // Assign Modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [usersToAssign, setUsersToAssign] = useState<any[]>([]);
    const [queuesToAssign, setQueuesToAssign] = useState<any[]>([]);
    const [assignTab, setAssignTab] = useState<"USERS" | "QUEUES">("USERS");

    // Save Contact
    const [contactExists, setContactExists] = useState(true); // default true to hide button until checked
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "", company: "" });

    const userId = getUserIdFromToken();

    const selectedConversation = conversations.find((c) => c.ConversationId === selectedConversationId);

    // Check if contact already exists when conversation changes
    useEffect(() => {
        if (!selectedConversation) { setContactExists(true); return; }
        const phone = selectedConversation.ExternalUserId?.replace("@s.whatsapp.net", "") || "";
        if (!phone) { setContactExists(true); return; }
        api.get("/api/contacts", { params: { search: phone } })
            .then(res => {
                const list = Array.isArray(res.data) ? res.data : [];
                setContactExists(list.some((c: any) => c.Phone?.includes(phone)));
            })
            .catch(() => setContactExists(true));
    }, [selectedConversationId]);

    useEffect(() => {
        api.get<any[]>("/api/canned-responses")
            .then(res => {
                if (Array.isArray(res.data)) {
                    setCannedResponses(res.data);
                } else {
                    console.error("API returned non-array for canned responses (ChatWindow):", res.data);
                    setCannedResponses([]);
                }
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!showScrollButton) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, showScrollButton]);

    const handleScroll = () => {
        if (!chatContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        const isBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isBottom);
    };

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setText(val);

        if (val.startsWith("/")) {
            setShowCannedMenu(true);
            setCannedFilter(val.slice(1).toLowerCase());
        } else {
            setShowCannedMenu(false);
        }
    };

    const selectCanned = (content: string) => {
        setText(content);
        setShowCannedMenu(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !showCannedMenu) {
            sendReply();
        }
    };

    async function sendReply(contentOverride?: string) {
        const bodyText = contentOverride ?? text;
        if (!bodyText.trim() || !selectedConversationId || sending) return;
        setSending(true);
        try {
            await api.post(`/api/conversations/${selectedConversationId}/reply`, { text: bodyText });

            if (!contentOverride) setText("");
            setShowScrollButton(false);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        } catch (err: any) {
            showToast("Erro: " + err.message, "error");
        } finally {
            setSending(false);
        }
    }

    async function handleStatus(status: "OPEN" | "RESOLVED") {
        if (!selectedConversationId) return;
        await api.post(`/api/conversations/${selectedConversationId}/status`, { status });
        refreshConversations();
    }

    async function handleAssign(queueId: string | null, assignUserId: string | null) {
        if (!selectedConversationId) return;
        await api.post(`/api/conversations/${selectedConversationId}/assign`, { queueId, userId: assignUserId });
        refreshConversations();
        if (showAssignModal) setShowAssignModal(false);
    }

    async function openAssignModal() {
        try {
            const [uRes, qRes] = await Promise.all([
                api.get<any[]>("/api/users"),
                api.get<any[]>("/api/queues")
            ]);
            setUsersToAssign(Array.isArray(uRes.data) ? uRes.data : []);
            setQueuesToAssign(Array.isArray(qRes.data) ? qRes.data : []);
            setAssignTab("USERS");
            setShowAssignModal(true);
        } catch (e: any) {
            showToast(e.message, "error");
        }
    }

    if (!selectedConversation) {
        return (
            <div className="empty-state">
                <MessageCircleOff className="icon" size={64} />
                <p>Selecione uma conversa para começar</p>
            </div>
        );
    }

    const filteredCanned = cannedResponses.filter(c =>
        c.Shortcut.toLowerCase().includes(cannedFilter) ||
        c.Title.toLowerCase().includes(cannedFilter)
    );

    return (
        <>
            <div className="chat-header">
                <div className="info" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button className="mobile-back-btn" onClick={() => setSelectedConversationId(null)}>
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2>{selectedConversation.Title || formatPhone(selectedConversation.ExternalUserId)}</h2>
                        <p>
                            {formatPhone(selectedConversation.ExternalUserId)} • {selectedConversation.Kind} • {selectedConversation.Status}
                            {selectedConversation.QueueName && ` • Fila: ${selectedConversation.QueueName}`}
                        </p>
                    </div>
                </div>
                <div className="actions" style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <button
                        onClick={async () => {
                            if (!confirm("Tem certeza que deseja apagar esta conversa e todo o histórico?")) return;
                            try {
                                await api.delete(`/api/conversations/${selectedConversationId}`);
                                showToast("Conversa apagada", "success");
                                refreshConversations();
                                setSelectedConversationId(null);
                            } catch (e: any) {
                                showToast("Erro: " + e.message, "error");
                            }
                        }}
                        className="icon-btn"
                        title="Apagar Conversa"
                        style={{ color: "#ea4335" }}
                    >
                        <Trash2 size={18} />
                    </button>
                    {selectedConversation.Status === "OPEN" && (
                        <button onClick={() => handleStatus("RESOLVED")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#f0f2f5", border: "none", color: "green", borderRadius: 6, cursor: "pointer", fontWeight: 500 }} title="Resolver">
                            <CheckCircle size={16} /> Resolver
                        </button>
                    )}
                    {selectedConversation.Status === "RESOLVED" && (
                        <button onClick={() => handleStatus("OPEN")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#f0f2f5", border: "none", color: "orange", borderRadius: 6, cursor: "pointer", fontWeight: 500 }} title="Reabrir">
                            <RotateCcw size={16} /> Reabrir
                        </button>
                    )}

                    {!selectedConversation.AssignedUserId && (
                        <button onClick={() => handleAssign(selectedConversation.QueueId || null, userId)} style={{ padding: "5px 10px", background: "#00a884", border: "none", color: "white", borderRadius: 5, cursor: "pointer" }}>
                            Pegar Atendimento
                        </button>
                    )}
                    {selectedConversation.AssignedUserId === userId && (
                        <button onClick={() => {
                            if (confirm("Devolver para a fila geral?")) handleAssign(null, null);
                        }} style={{ padding: "5px 10px", background: "#f0f2f5", border: "none", color: "#54656f", borderRadius: 5, cursor: "pointer", marginLeft: 10 }}>
                            Devolver
                        </button>
                    )}

                    {selectedConversation.Status === "OPEN" && (
                        <button onClick={openAssignModal} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "#f0f2f5", border: "none", color: "#54656f", borderRadius: 5, cursor: "pointer", marginLeft: 10 }}>
                            <UsersIcon size={16} /> Transferir
                        </button>
                    )}

                    {!contactExists && (
                        <button
                            onClick={() => {
                                const phone = selectedConversation.ExternalUserId?.replace("@s.whatsapp.net", "") || "";
                                const title = selectedConversation.Title || "";
                                const name = title.startsWith("WhatsApp") ? phone : title;
                                setContactForm({ name, phone, email: "", company: "" });
                                setShowContactModal(true);
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#f0f2f5", border: "none", color: "#54656f", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}
                            title="Salvar Contato"
                        >
                            <UserPlus size={16} /> Salvar Contato
                        </button>
                    )}

                    <button
                        onClick={async () => {
                            if (!confirm("Deseja re-conectar esta conversa ao Provider Padrão do sistema?")) return;
                            try {
                                const res = await api.post(`/api/conversations/${selectedConversationId}/reassign-connector`);
                                alert("Conectado ao provider: " + res.data.provider);
                            } catch (e: any) { alert("Erro: " + (e.response?.data?.error || e.message)); }
                        }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 12px", background: "#f0f2f5", border: "none", color: "#666", borderRadius: 6, cursor: "pointer", marginLeft: 10 }}
                        title="Trocar para Provider Padrão"
                    >
                        <Zap size={16} />
                    </button>
                </div>
            </div>

            <div className="chat-messages" ref={chatContainerRef} onScroll={handleScroll}>
                {messages.map((m) => (
                    <div key={m.MessageId} className={`bubble-row ${m.Direction === "OUT" ? "out" : "in"}`}>
                        <div className="bubble">
                            {m.Direction === "IN" && (
                                <div className="sender">{selectedConversation.Title && !selectedConversation.Title.startsWith("WhatsApp") ? selectedConversation.Title : formatPhone(m.SenderExternalId) || "Cliente"}</div>
                            )}
                            {m.Direction === "OUT" && <div className="sender" style={{ color: "#8bb8a8" }}>Agente</div>}

                            {m.MediaType === "image" && m.MediaUrl && (
                                <div className="media-attachment" style={{ cursor: "zoom-in" }} onClick={() => setViewingImage(m.MediaUrl!)}>
                                    <img src={m.MediaUrl} alt="Imagem" style={{ maxWidth: "100%", borderRadius: 8, marginTop: 4 }} />
                                </div>
                            )}
                            {m.MediaType === "audio" && m.MediaUrl && (
                                <div className="media-attachment">
                                    <AudioPlayer src={m.MediaUrl} />
                                </div>
                            )}
                            {m.MediaType === "video" && m.MediaUrl && (
                                <div className="media-attachment">
                                    <video controls src={m.MediaUrl} style={{ maxWidth: "100%", borderRadius: 8, marginTop: 4 }} />
                                </div>
                            )}
                            {m.MediaType === "document" && m.MediaUrl && (
                                <DocumentCard url={m.MediaUrl} name={m.Body || 'Documento'} direction={m.Direction as any} />
                            )}

                            <div className="text">{m.Body}</div>
                            <div className="timestamp">
                                {formatTime(m.CreatedAt)}
                                {m.Direction === "OUT" && (
                                    <span style={{ marginLeft: 4, fontSize: '1.2em' }} title={m.Status || undefined}>
                                        {m.Status === "READ" ? <span style={{ color: "#53bdeb" }}>✓✓</span> : m.Status === "DELIVERED" ? "✓✓" : m.Status === "SENT" ? "✓" : "🕒"}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {showScrollButton && (
                <button
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                    style={{
                        position: "absolute", bottom: 80, right: 20, width: 40, height: 40, borderRadius: "50%",
                        backgroundColor: "#202c33", color: "#00a884", border: "1px solid #333", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.3)", zIndex: 100
                    }}
                >
                    <ChevronDown size={20} />
                </button>
            )}

            <div className="chat-input-bar" style={{ position: "relative", flexShrink: 0 }}>
                {showEmojiPicker && (
                    <div style={{ position: "absolute", bottom: "60px", left: "0" }}>
                        <EmojiPicker onSelect={(emoji) => setText(prev => prev + emoji)} onClose={() => setShowEmojiPicker(false)} />
                    </div>
                )}

                {showCannedMenu && (
                    <div className="canned-menu" style={{ position: "absolute", bottom: 60, left: 20, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, maxHeight: 200, overflowY: "auto", width: 300, zIndex: 10 }}>
                        {filteredCanned.length === 0 && <div style={{ padding: 10, color: "#888" }}>Nenhuma resposta encontrada</div>}
                        {filteredCanned.map(c => (
                            <div
                                key={c.CannedResponseId}
                                onClick={() => selectCanned(c.Content)}
                                style={{ padding: "10px", cursor: "pointer", borderBottom: "1px solid #333", display: "flex", flexDirection: "column" }}
                                className="canned-item"
                            >
                                <div style={{ fontWeight: "bold", color: "#00a884" }}>/{c.Shortcut} <span style={{ color: "var(--text-primary)" }}>{c.Title}</span></div>
                                <div style={{ fontSize: "0.85em", color: "#ccc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.Content}</div>
                            </div>
                        ))}
                    </div>
                )}
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 10px", color: "var(--text-secondary)" }} title="Emojis">
                    <Smile size={24} />
                </button>
                <button onClick={() => setShowTemplateModal(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 10px", color: "var(--text-secondary)" }} title="Modelos (HSM)">
                    <FileText size={24} />
                </button>
                <input
                    ref={inputRef}
                    placeholder="Digite uma mensagem (ou / para respostas rápidas)"
                    value={text}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                />
                <button className="btn btn-primary" onClick={() => sendReply()} disabled={sending} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Send size={18} /> {sending ? "Enviando…" : "Enviar"}
                </button>
            </div>

            {showTemplateModal && (
                <TemplateModal
                    onClose={() => setShowTemplateModal(false)}
                    onSend={(txt) => sendReply(txt)}
                />
            )}

            {viewingImage && (
                <ImageViewerModal
                    src={viewingImage}
                    onClose={() => setViewingImage(null)}
                />
            )}

            {showAssignModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
                }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 25, borderRadius: 10, width: 420 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Transferir Atendimento</h3>

                        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 15 }}>
                            <button
                                onClick={() => setAssignTab("USERS")}
                                style={{ flex: 1, padding: 10, background: "transparent", border: "none", color: assignTab === "USERS" ? "#00a884" : "#8696a0", borderBottom: assignTab === "USERS" ? "2px solid #00a884" : "none", cursor: "pointer" }}
                            >
                                Usuários
                            </button>
                            <button
                                onClick={() => setAssignTab("QUEUES")}
                                style={{ flex: 1, padding: 10, background: "transparent", border: "none", color: assignTab === "QUEUES" ? "#00a884" : "#8696a0", borderBottom: assignTab === "QUEUES" ? "2px solid #00a884" : "none", cursor: "pointer" }}
                            >
                                Filas
                            </button>
                        </div>

                        <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 20 }}>
                            {assignTab === "USERS" ? (
                                <>
                                    {usersToAssign.filter(u => u.UserId !== userId).map(u => (
                                        <div key={u.UserId} style={{ padding: 10, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{u.AgentName || 'Sem Nome'}</div>
                                                <div style={{ fontSize: "0.8em", color: "var(--text-secondary)" }}>{u.Email}</div>
                                            </div>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: "6px 12px", fontSize: "0.8em" }}
                                                onClick={() => handleAssign(null, u.UserId)}
                                            >
                                                Transferir
                                            </button>
                                        </div>
                                    ))}
                                    {usersToAssign.filter(u => u.UserId !== userId).length === 0 && (
                                        <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>Nenhum outro usuário disponível</div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {queuesToAssign.map(q => (
                                        <div key={q.QueueId} style={{ padding: 10, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{q.Name}</div>
                                                <div style={{ fontSize: "0.8em", color: "var(--text-secondary)" }}>{q.IsActive ? 'Ativa' : 'Inativa'}</div>
                                            </div>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: "6px 12px", fontSize: "0.8em" }}
                                                onClick={() => handleAssign(q.QueueId, null)}
                                            >
                                                Mover
                                            </button>
                                        </div>
                                    ))}
                                    {queuesToAssign.length === 0 && (
                                        <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>Nenhuma fila disponível</div>
                                    )}
                                </>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAssignModal(false)}
                            style={{ width: "100%", padding: 10, background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 5, cursor: "pointer" }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {showContactModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
                }} onClick={(e) => { if (e.target === e.currentTarget) setShowContactModal(false); }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 16, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                        <h3 style={{ marginTop: 0, marginBottom: 24, display: "flex", alignItems: "center", gap: 10, fontSize: "1.2rem", color: "#e9edef" }}>
                            <UserPlus size={22} color="#00a884" /> Salvar Contato
                        </h3>

                        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                            <div>
                                <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", color: "#8696a0", fontWeight: 500 }}>Nome</label>
                                <input
                                    placeholder="Nome do contato"
                                    value={contactForm.name}
                                    onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                                    autoFocus
                                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", color: "#8696a0", fontWeight: 500 }}>Telefone</label>
                                <input
                                    value={contactForm.phone}
                                    readOnly
                                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-hover)", color: "var(--text-secondary)", fontSize: 14, outline: "none", cursor: "not-allowed", boxSizing: "border-box" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", color: "#8696a0", fontWeight: 500 }}>
                                    Email <span style={{ opacity: 0.6 }}>(opcional)</span>
                                </label>
                                <input
                                    type="email"
                                    placeholder="email@exemplo.com"
                                    value={contactForm.email}
                                    onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", color: "#8696a0", fontWeight: 500 }}>
                                    Empresa <span style={{ opacity: 0.6 }}>(opcional)</span>
                                </label>
                                <input
                                    placeholder="Nome da empresa"
                                    value={contactForm.company}
                                    onChange={e => setContactForm({ ...contactForm, company: e.target.value })}
                                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                                />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                            <button
                                onClick={() => setShowContactModal(false)}
                                style={{ flex: 1, padding: "12px 16px", background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "background 0.2s" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                                Cancelar
                            </button>
                            <button
                                style={{ flex: 1, padding: "12px 16px", background: "#00a884", border: "none", color: "#fff", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, opacity: (!contactForm.name.trim() || !contactForm.phone.trim()) ? 0.5 : 1, transition: "opacity 0.2s" }}
                                disabled={!contactForm.name.trim() || !contactForm.phone.trim()}
                                onClick={async () => {
                                    try {
                                        await api.post("/api/contacts", {
                                            name: contactForm.name,
                                            phone: contactForm.phone,
                                            email: contactForm.email || undefined,
                                            notes: contactForm.company ? `Empresa: ${contactForm.company}` : undefined
                                        });
                                        showToast("Contato salvo com sucesso!", "success");
                                        setContactExists(true);
                                        setShowContactModal(false);
                                    } catch (e: any) {
                                        showToast("Erro: " + (e.response?.data?.error || e.message), "error");
                                    }
                                }}
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
