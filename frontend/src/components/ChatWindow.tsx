import React, { useState, useRef, useEffect, useMemo } from "react";
import { MessageCircleOff, ArrowLeft, Trash2, CheckCircle, RotateCcw, Users as UsersIcon, Zap, ChevronDown, Smile, FileText, Send, UserPlus, StickyNote, MessageSquare, Mail, Monitor, BookOpen } from "lucide-react";

import { useChat } from "../contexts/ChatContext";
import { AudioPlayer } from "./AudioPlayer";
import { EmojiPicker } from "./EmojiPicker";
import { TemplateModal } from "./TemplateModal";
import { ImageViewerModal } from "./ImageViewerModal";
import { DocumentCard } from "./DocumentCard";
import { TagPill } from "./TagPill";
import type { Tag } from "../../../shared/types";

import { api } from "../lib/api";

function formatTime(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatPhone(ext: string) {
    if (!ext) return "";
    return ext.replace("@s.whatsapp.net", "").replace("@c.us", "");
}

function getChannelIcon(source: string | undefined) {
    const s = (source || "").toUpperCase();
    if (s.includes("WHATSAPP")) return <MessageSquare size={18} style={{ color: "#25D366" }} />;
    if (s.includes("EMAIL")) return <Mail size={18} style={{ color: "#EA4335" }} />;
    return <Monitor size={18} style={{ color: "#8696a0" }} />;
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
    const { conversations, selectedConversationId, setSelectedConversationId, messages, refreshConversations, typingUsers, emitTyping } = useChat();
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [showScrollButton, setShowScrollButton] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Internal Note mode
    const [noteMode, setNoteMode] = useState(false);

    // Canned Responses
    const [cannedResponses, setCannedResponses] = useState<any[]>([]);
    const [showCannedMenu, setShowCannedMenu] = useState(false);
    const [cannedFilter, setCannedFilter] = useState("");

    // Assign Modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [usersToAssign, setUsersToAssign] = useState<any[]>([]);
    const [queuesToAssign, setQueuesToAssign] = useState<any[]>([]);
    const [assignTab, setAssignTab] = useState<"USERS" | "QUEUES">("USERS");
    const [transferReason, setTransferReason] = useState("");

    // Save Contact
    const [contactExists, setContactExists] = useState(true); // default true to hide button until checked
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "", company: "" });

    // Tag Management
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [showTagMenu, setShowTagMenu] = useState(false);

    // Ticket & KB States
    const [activeTicket, setActiveTicket] = useState<any>(null);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [ticketPriority, setTicketPriority] = useState("MEDIUM");
    const [showKBModal, setShowKBModal] = useState(false);
    const [kbArticles, setKbArticles] = useState<any[]>([]);
    const [kbSearch, setKbSearch] = useState("");

    useEffect(() => {
        if (selectedConversationId) {
            loadActiveTicket();
        } else {
            setActiveTicket(null);
        }
    }, [selectedConversationId]);

    const loadActiveTicket = async () => {
        try {
            const res = await api.get(`/api/conversations/${selectedConversationId}/ticket`);
            setActiveTicket(res.data);
        } catch (e) {
            console.error("Error loading ticket:", e);
        }
    };

    const handleCreateTicket = async () => {
        try {
            const res = await api.post(`/api/conversations/${selectedConversationId}/ticket`, { priority: ticketPriority });
            setActiveTicket(res.data);
            setShowTicketModal(false);
            showToast("Ticket criado com sucesso", "success");
        } catch (e: any) {
            showToast("Erro ao criar ticket: " + (e.response?.data?.error || e.message), "error");
        }
    };

    const loadKbArticles = async () => {
        try {
            const res = await api.get("/api/knowledge");
            setKbArticles(Array.isArray(res.data) ? res.data : []);
            setShowKBModal(true);
        } catch (e) {
            console.error("Error loading KB:", e);
        }
    };


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
        api.get<any[]>("/api/tags")
            .then(res => setAllTags(Array.isArray(res.data) ? res.data : []))
            .catch(console.error);
    }, []);

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

        // Typing indicator
        if (selectedConversationId) {
            emitTyping(selectedConversationId, true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                emitTyping(selectedConversationId, false);
            }, 2500);
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
            if (noteMode && !contentOverride) {
                await api.post(`/api/conversations/${selectedConversationId}/note`, { text: bodyText });
            } else {
                await api.post(`/api/conversations/${selectedConversationId}/reply`, { text: bodyText });
            }

            if (!contentOverride) setText("");
            setShowScrollButton(false);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        } catch (err: any) {
            showToast("Erro: " + (err.response?.data?.error || err.message), "error");
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
        await api.post(`/api/conversations/${selectedConversationId}/assign`, { queueId, userId: assignUserId, reason: transferReason || undefined });
        refreshConversations();
        if (showAssignModal) {
            setShowAssignModal(false);
            setTransferReason("");
        }
    }

    async function handleAddTag(tagId: string) {
        if (!selectedConversationId) return;
        await api.post(`/api/tags/conversations/${selectedConversationId}`, { tagId });
        refreshConversations();
        setShowTagMenu(false);
    }

    async function handleRemoveTag(tagId: string) {
        if (!selectedConversationId) return;
        await api.delete(`/api/tags/conversations/${selectedConversationId}/${tagId}`);
        refreshConversations();
    }

    async function handleDeleteMessage(messageId: string) {
        if (!confirm("Tem certeza que deseja apagar esta mensagem?")) return;
        try {
            await api.delete(`/api/conversations/${selectedConversationId}/messages/${messageId}`);
            showToast("Mensagem apagada", "success");
        } catch (e: any) {
            showToast("Erro ao apagar mensagem", "error");
        }
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
            <div className="chat-header" style={{ height: "85px", background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 25px", flexShrink: 0 }}>
                <div className="info" style={{ display: "flex", alignItems: "center", gap: 15, minWidth: 0 }}>
                    <button className="mobile-back-btn" onClick={() => setSelectedConversationId(null)} style={{ marginRight: 10 }}>
                        <ArrowLeft size={24} />
                    </button>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
                        {(selectedConversation.Title || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {getChannelIcon(selectedConversation.SourceChannel)}
                            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {selectedConversation.Title || formatPhone(selectedConversation.ExternalUserId)}
                            </h2>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                {formatPhone(selectedConversation.ExternalUserId)}
                            </span>
                            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--border)" }} />
                            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, color: selectedConversation.Status === "OPEN" ? "#00a884" : "#8696a0" }}>
                                {selectedConversation.Status}
                            </span>
                            {selectedConversation.QueueName && (
                                <>
                                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--border)" }} />
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{selectedConversation.QueueName}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginRight: 10 }}>
                        {selectedConversation.Tags?.map(tag => (
                            <TagPill key={tag.TagId} tag={tag} onRemove={() => handleRemoveTag(tag.TagId)} />
                        ))}
                        <div style={{ position: "relative" }}>
                            <button
                                onClick={() => setShowTagMenu(!showTagMenu)}
                                style={{ background: "rgba(0,168,132,0.1)", border: "1px dashed #00a884", color: "#00a884", cursor: "pointer", fontSize: "0.7rem", padding: "2px 8px", borderRadius: 8, display: "flex", alignItems: "center", fontWeight: 600 }}
                            >
                                + TAG
                            </button>
                            {showTagMenu && (
                                <div style={{ position: "absolute", top: 30, right: 0, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 100, width: 180, maxHeight: 200, overflowY: "auto", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", padding: 5 }}>
                                    {allTags.filter(t => !selectedConversation.Tags?.find(st => st.TagId === t.TagId)).map(tag => (
                                        <div key={tag.TagId} onClick={() => { handleAddTag(tag.TagId); setShowTagMenu(false); }} style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 6, fontSize: "0.85rem", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: tag.Color || "#ccc" }} />
                                                {tag.Name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {!activeTicket ? (
                        <button onClick={() => setShowTicketModal(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "var(--accent)", border: "none", color: "white", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", boxShadow: "0 4px 10px rgba(0, 168, 132, 0.2)" }} title="Abrir Ticket">
                            <FileText size={16} /> Abrir Ticket
                        </button>
                    ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "rgba(0, 168, 132, 0.1)", color: "#00a884", borderRadius: 10, fontSize: "0.85rem", fontWeight: 700, border: "1px solid rgba(0, 168, 132, 0.2)" }}>
                            TICKET #{activeTicket.TicketId?.substring(0, 5)}
                        </div>
                    )}

                    <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 5px" }} />

                    {!selectedConversation.AssignedUserId && (
                        <button onClick={() => handleAssign(selectedConversation.QueueId || null, userId)} style={{ background: "#00a884", border: "none", color: "white", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                            Assumir
                        </button>
                    )}

                    {selectedConversation.AssignedUserId === userId && (
                        <button onClick={() => handleAssign(null, null)} style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-secondary)", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Devolver para Fila">
                            <RotateCcw size={18} />
                        </button>
                    )}

                    {selectedConversation.Status === "OPEN" && (
                        <button onClick={openAssignModal} style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-secondary)", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Transferir Atendimento">
                            <UsersIcon size={18} />
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
                            style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-secondary)", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                            title="Salvar Contato"
                        >
                            <UserPlus size={18} />
                        </button>
                    )}

                    <button
                        onClick={async () => {
                            if (!confirm("Deseja re-conectar esta conversa ao Provider Padrão?")) return;
                            try { await api.post(`/api/conversations/${selectedConversationId}/reassign-connector`); showToast("Re-conectado ao provider padrão", "success"); } catch (e: any) { showToast("Erro ao re-conectar", "error"); }
                        }}
                        style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-secondary)", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                        title="Trocar Provider"
                    >
                        <Zap size={18} />
                    </button>

                    <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 5px" }} />

                    {selectedConversation.Status === "OPEN" ? (
                        <button onClick={() => handleStatus("RESOLVED")} style={{ background: "rgba(0, 168, 132, 0.1)", border: "none", color: "#00a884", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Resolver Conversa">
                            <CheckCircle size={20} />
                        </button>
                    ) : (
                        <button onClick={() => handleStatus("OPEN")} style={{ background: "rgba(255, 152, 0, 0.1)", border: "none", color: "#ff9800", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Reabrir Conversa">
                            <RotateCcw size={20} />
                        </button>
                    )}

                    <button
                        onClick={async () => {
                            if (!confirm("Tem certeza que deseja apagar esta conversa?")) return;
                            try {
                                await api.delete(`/api/conversations/${selectedConversationId}`);
                                showToast("Conversa apagada", "success");
                                refreshConversations();
                                setSelectedConversationId(null);
                            } catch (e: any) { showToast("Erro: " + e.message, "error"); }
                        }}
                        style={{ background: "rgba(234, 67, 53, 0.1)", border: "none", color: "#ea4335", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                        title="Apagar Conversa"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>


            <div className="chat-messages" ref={chatContainerRef} onScroll={handleScroll}>
                {messages.map((m) => (
                    <div key={m.MessageId} className={`bubble-row ${m.Direction === "INTERNAL" ? "internal" : m.Direction === "OUT" ? "out" : "in"}`}>
                        <div className="bubble" style={m.Direction === "INTERNAL" ? { background: "#fef3c7", border: "1px solid #fbbf24" } : undefined}>
                            {m.Direction === "INTERNAL" && (
                                <div className="sender" style={{ color: "#92400e", display: "flex", alignItems: "center", gap: 4 }}>📌 Nota Interna</div>
                            )}
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

                            <div className="text" style={m.Direction === "INTERNAL" ? { color: "#78350f" } : undefined}>
                                {selectedConversation.SourceChannel?.includes("EMAIL") && m.Direction === "IN" ? (
                                    <div style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #eee", fontSize: "0.9rem", color: "#444" }}>
                                        {/* Simple formatting for email content: preserve whitespace and handle basic wrapping */}
                                        <div style={{ whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                                            {m.Body}
                                        </div>
                                    </div>
                                ) : (
                                    m.Body
                                )}
                            </div>
                            <div className="timestamp" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                <div>
                                    {formatTime(m.CreatedAt)}
                                    {m.Direction === "OUT" && (
                                        <span style={{ marginLeft: 4, fontSize: '1.2em' }} title={m.Status || undefined}>
                                            {m.Status === "READ" ? <span style={{ color: "#53bdeb" }}>✓✓</span> : m.Status === "DELIVERED" ? "✓✓" : m.Status === "SENT" ? "✓" : "🕒"}
                                        </span>
                                    )}
                                </div>
                                <button 
                                    onClick={() => handleDeleteMessage(m.MessageId)} 
                                    className="msg-delete-btn"
                                    style={{ background: "none", border: "none", color: "rgba(0,0,0,0.2)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", transition: "color 0.2s" }}
                                    title="Apagar mensagem"
                                    onMouseEnter={e => e.currentTarget.style.color = "#ea4335"}
                                    onMouseLeave={e => e.currentTarget.style.color = "rgba(0,0,0,0.2)"}
                                >
                                    <Trash2 size={14} />
                                </button>
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
                {/* Typing Indicator */}
                {selectedConversationId && typingUsers[selectedConversationId] && (
                    <div style={{
                        position: "absolute", top: -36, left: 16,
                        display: "flex", alignItems: "center", gap: 8,
                        background: "var(--bg-secondary)", border: "1px solid var(--border)",
                        padding: "5px 14px", borderRadius: 20, fontSize: "0.8rem", color: "var(--text-secondary)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)", animation: "fadeIn 0.2s ease-out"
                    }}>
                        <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
                            {[0, 1, 2].map(i => (
                                <span key={i} style={{
                                    width: 6, height: 6, borderRadius: "50%", background: "var(--accent)",
                                    display: "inline-block",
                                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`
                                }} />
                            ))}
                        </span>
                        <span>{typingUsers[selectedConversationId]} está digitando...</span>
                    </div>
                )}

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
                <button onClick={() => setShowCannedMenu(!showCannedMenu)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 10px", color: "var(--text-secondary)" }} title="Respostas Rápidas">
                    <Zap size={24} />
                </button>
                <button onClick={loadKbArticles} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 10px", color: "var(--text-secondary)" }} title="Base de Conhecimento">
                    <BookOpen size={24} />
                </button>
                <button onClick={() => setShowTemplateModal(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 10px", color: "var(--text-secondary)" }} title="Modelos (HSM)">
                    <FileText size={24} />
                </button>
                <button
                    onClick={() => setNoteMode(!noteMode)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "0 10px", color: noteMode ? "#f59e0b" : "var(--text-secondary)" }}
                    title={noteMode ? "Modo Nota (clique para voltar)" : "Nota Interna"}
                >
                    <StickyNote size={24} />
                </button>

                <input
                    ref={inputRef}
                    placeholder={noteMode ? "📌 Escreva uma nota interna..." : "Digite uma mensagem (ou / para respostas rápidas)"}
                    value={text}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    style={noteMode ? { background: "#fef3c7", color: "#78350f" } : undefined}
                />
                <button className={noteMode ? "btn" : "btn btn-primary"} onClick={() => sendReply()} disabled={sending} style={{ display: "flex", alignItems: "center", gap: 6, ...(noteMode ? { background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer" } : {}) }}>
                    {noteMode ? <StickyNote size={18} /> : <Send size={18} />} {sending ? "Enviando…" : noteMode ? "Nota" : "Enviar"}
                </button>
            </div>

            {showTemplateModal && (
                <TemplateModal
                    onClose={() => setShowTemplateModal(false)}
                    onSend={(txt) => sendReply(txt)}
                />
            )}

            {showTicketModal && (
                <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 25, borderRadius: 10, width: 400 }}>
                        <h3 style={{ marginTop: 0 }}>Abrir Ticket</h3>
                        <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>Deseja transformar esta conversa em um ticket com SLA?</p>
                        
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", color: "#8696a0" }}>Prioridade</label>
                            <select value={ticketPriority} onChange={e => setTicketPriority(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                                <option value="LOW">Baixa</option>
                                <option value="MEDIUM">Média</option>
                                <option value="HIGH">Alta</option>
                                <option value="CRITICAL">Crítica</option>
                            </select>
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 25 }}>
                            <button onClick={() => setShowTicketModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                            <button onClick={handleCreateTicket} className="btn btn-primary" style={{ flex: 1 }}>Criar Ticket</button>
                        </div>
                    </div>
                </div>
            )}

            {showKBModal && (
                <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 25, borderRadius: 10, width: 700, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h3 style={{ margin: 0 }}>Base de Conhecimento</h3>
                            <button onClick={() => setShowKBModal(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
                                <RotateCcw size={18} />
                            </button>
                        </div>

                        <input 
                            placeholder="Buscar artigos..." 
                            value={kbSearch} 
                            onChange={e => setKbSearch(e.target.value)}
                            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", marginBottom: 15, boxSizing: "border-box" }}
                        />

                        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                            {kbArticles.filter(a => a.Title.toLowerCase().includes(kbSearch.toLowerCase()) || a.Category?.toLowerCase().includes(kbSearch.toLowerCase())).map(article => (
                                <div key={article.ArticleId} style={{ padding: 15, border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", transition: "background 0.2s" }} 
                                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    onClick={() => {
                                        setText(text + article.Content.replace(/<[^>]*>?/gm, ''));
                                        setShowKBModal(false);
                                    }}>
                                    <div style={{ fontWeight: 600, color: "var(--accent)", fontSize: "0.8rem" }}>{article.Category || "Geral"}</div>
                                    <div style={{ fontWeight: 700, fontSize: "1.05rem", margin: "4px 0" }}>{article.Title}</div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                        {article.Content.replace(/<[^>]*>?/gm, '')}
                                    </div>
                                </div>
                            ))}
                            {kbArticles.length === 0 && <div style={{ textAlign: "center", color: "#8696a0", padding: 20 }}>Nenhum artigo encontrado.</div>}
                        </div>
                    </div>
                </div>
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

                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", color: "#8696a0" }}>Motivo da transferência (opcional)</label>
                            <textarea
                                value={transferReason}
                                onChange={e => setTransferReason(e.target.value)}
                                placeholder="Ex: Cliente precisa de suporte técnico avançado..."
                                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", resize: "vertical", minHeight: 60, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }}
                            />
                        </div>

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
