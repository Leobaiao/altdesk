import React, { useState, useMemo } from "react";
import { Plus, Search, MessageSquare, Mail, Monitor } from "lucide-react";
import { useChat } from "../contexts/ChatContext";
import type { Conversation, Tag } from "../../../shared/types";
import { TagPill } from "./TagPill";
import { api } from "../lib/api";
import { getUserIdFromToken } from "../lib/auth";


function TabButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                flex: 1, padding: 12,
                background: "transparent",
                border: "none",
                color: active ? "#00a884" : "#8696a0",
                cursor: "pointer",
                borderBottom: active ? "2px solid #00a884" : "2px solid transparent",
                fontWeight: 500
            }}
        >
            {label}
        </button>
    );
}

function formatTime(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatPhone(ext: string) {
    if (!ext) return "";
    return ext.replace("@s.whatsapp.net", "").replace("@c.us", "");
}

function getChannelIcon(source: string | undefined, kind?: string) {
    if ((kind === "DIRECT" || kind === "INTERNAL") && (!source || source === "INTERNAL")) {
        return <Monitor size={14} style={{ color: "#00a884" }} />; // Or Users icon
    }
    const s = (source || "").toUpperCase();
    if (s.includes("WHATSAPP")) return <MessageSquare size={14} style={{ color: "#25D366" }} />;
    if (s.includes("EMAIL")) return <Mail size={14} style={{ color: "#EA4335" }} />;
    return <Monitor size={14} style={{ color: "#8696a0" }} />;
}

function getConversationTitle(c: Conversation, currentUserId: string | undefined, role: string) {
    if (c.Kind === "INTERNAL") {
        if (c.RequesterUserId === currentUserId) return c.AssignedUserName || "Atendimento";
        if (c.AssignedUserId === currentUserId) return c.ContactName || "Atendimento";
        return c.Title || "Suporte Interno";
    }

    // Se eu for o colaborador, o título deve ser o assunto do ticket (Title)
    if (role === 'END_USER') {
        return c.Title || "Meu Chamado";
    }

    // Se eu for agente/admin, o título deve ser o nome do cliente/colaborador
    if (c.ContactName) return c.ContactName;
    
    return c.Title || formatPhone(c.ExternalUserId) || "Cliente";
}


export function Sidebar({ setView }: { setView: (view: any) => void }) {
    const { conversations, selectedConversationId, setSelectedConversationId, accountStatus, refreshConversations, showToast } = useChat();
    const token = localStorage.getItem("token");
    const role = useMemo(() => {
        if (!token) return "AGENT";
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            return payload.role;
        } catch { return "AGENT"; }
    }, [token]);

    const [tab, setTab] = useState<"MY" | "QUEUE" | "ALL" | "RESOLVED">(
        (role === "ADMIN" || role === "SUPERADMIN") ? "ALL" : "MY"
    );
    const [search, setSearch] = useState("");
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [contactSearch, setContactSearch] = useState("");
    const [contacts, setContacts] = useState<any[]>([]);
    const [internalUsers, setInternalUsers] = useState<any[]>([]);


    const handleOpenNewChat = async () => {
        try {
            const [cRes, uRes] = await Promise.all([
                api.get("/api/contacts"),
                api.get("/api/users")
            ]);
            setContacts(Array.isArray(cRes.data) ? cRes.data : []);
            setInternalUsers(Array.isArray(uRes.data) ? uRes.data : []);
            setShowNewChatModal(true);
        } catch (e) {
            console.error(e);
        }
    };

    const handleStartChat = async (target: { Phone?: string, Name?: string, UserId?: string }) => {
        try {
            const payload = target.UserId ? { userId: target.UserId } : { phone: target.Phone, name: target.Name };
            const res = await api.post("/api/conversations", payload);
            setSelectedConversationId(res.data.conversationId);
            setShowNewChatModal(false);
            setContactSearch("");
            refreshConversations();
        } catch (e: any) {
            showToast("Erro: " + (e.response?.data?.error || e.message), "error");
        }
    };

    const userId = getUserIdFromToken();
    
    let myChats = conversations.filter(c => c.Status === "OPEN" && (c.AssignedUserId === userId || c.RequesterUserId === userId));
    let queueChats = conversations.filter(c => c.Status === "OPEN" && !c.AssignedUserId);
    let allChats = conversations.filter(c => c.Status === "OPEN");
    let resolvedChats = conversations.filter(c => c.Status === "RESOLVED");

    if (role === 'END_USER') {
        myChats = conversations.filter(c => (c.RequesterUserId === userId || c.AssignedUserId === userId) && c.Status === 'OPEN');
        queueChats = []; // Requesters don't see queues
        allChats = myChats; // For requesters, 'All' is just their chats
        resolvedChats = conversations.filter(c => (c.RequesterUserId === userId || c.AssignedUserId === userId) && c.Status === 'RESOLVED');
    }

    let displayedConversations = myChats;
    if (tab === "QUEUE") displayedConversations = queueChats;
    if (tab === "ALL") displayedConversations = allChats;
    if (tab === "RESOLVED") displayedConversations = resolvedChats;

    if (search.trim()) {
        const s = search.toLowerCase();
        displayedConversations = displayedConversations.filter(c =>
            (c.Title && c.Title.toLowerCase().includes(s)) ||
            (c.ExternalUserId && c.ExternalUserId.toLowerCase().includes(s))
        );
    }

    return (
        <div className="conversation-list-panel">
            <div className="sidebar-header" style={{ height: "85px", padding: "0 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-primary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Conversas</h2>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    {role !== 'END_USER' && (
                        <button 
                            onClick={handleOpenNewChat} 
                            title="Nova Conversa" 
                            style={{ 
                                background: "rgba(0, 168, 132, 0.1)", 
                                border: "none", 
                                color: "#00a884", 
                                cursor: "pointer", 
                                width: 36, 
                                height: 36, 
                                borderRadius: 10, 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center",
                                transition: "all 0.2s"
                            }}
                        >
                            <MessageSquare size={20} />
                        </button>
                    )}
                </div>
            </div>

            <div className="search-box" style={{ padding: 10, position: "relative" }}>
                <Search size={16} color="#8696a0" style={{ position: "absolute", left: 20, top: 20 }} />
                <input
                    placeholder="Buscar conversa…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: "100%", padding: "10px 10px 10px 34px", borderRadius: 8, border: "none", background: "var(--bg-hover)", color: "var(--text-primary)" }}
                />
            </div>

            <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                {(role === "ADMIN" || role === "SUPERADMIN") && (
                    <TabButton label="Todos" active={tab === "ALL"} onClick={() => setTab("ALL")} />
                )}
                <TabButton label="Minhas" active={tab === "MY"} onClick={() => setTab("MY")} />
                {role !== 'END_USER' && <TabButton label="Filas" active={tab === "QUEUE"} onClick={() => setTab("QUEUE")} />}
                <TabButton label="Resolvidos" active={tab === "RESOLVED"} onClick={() => setTab("RESOLVED")} />
            </div>

            <div className="conversation-list" style={{ flex: 1, overflowY: "auto" }}>
                {displayedConversations.map((c) => (
                    <div
                        key={c.ConversationId}
                        className={`conversation-item ${c.ConversationId === selectedConversationId ? "active" : ""}`}
                        onClick={() => setSelectedConversationId(c.ConversationId)}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                {getChannelIcon(c.SourceChannel, c.Kind)}
                                <div className="title" style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 5 }}>
                                    {c.TicketId && (
                                        <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>
                                            #{c.TicketId.substring(0, 5).toUpperCase()}
                                        </span>
                                    )}
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {getConversationTitle(c, userId, role)}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                {/* SLA Badge */}
                                {c.SlaStatus === "VIOLATED" && (
                                    <span title="SLA Violado" style={{ fontSize: "0.62rem", background: "rgba(234,67,53,0.15)", color: "#ea4335", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>⚠ SLA</span>
                                )}
                                {c.SlaStatus === "PENDING" && c.SlaDeadline && (() => {
                                    const minutesLeft = Math.round((new Date(c.SlaDeadline).getTime() - Date.now()) / 60000);
                                    if (minutesLeft > 0 && minutesLeft <= 15) {
                                        return <span title={`SLA expira em ${minutesLeft}min`} style={{ fontSize: "0.62rem", background: "rgba(255,152,0,0.15)", color: "#ff9800", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>⏱ {minutesLeft}m</span>;
                                    }
                                    return null;
                                })()}
                                {c.QueueName && (
                                    <span style={{ fontSize: "0.65rem", background: "var(--bg-hover)", color: "var(--text-secondary)", padding: "1px 4px", borderRadius: 3 }}>
                                        {c.QueueName}
                                    </span>
                                )}
                                <span className={`badge ${c.Status === "OPEN" ? "badge-open" : "badge-closed"}`} style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: 4 }}>
                                    {c.Status}
                                </span>
                            </div>
                        </div>
                        {c.Tags && c.Tags.filter(t => t.Name?.toUpperCase() !== 'TRIAL').length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginTop: 2 }}>
                                {c.Tags.filter(t => t.Name?.toUpperCase() !== 'TRIAL').map(t => <TagPill key={t.TagId} tag={t} size="sm" />)}
                            </div>
                        )}
                        <div className="meta" style={{ display: "flex", justifyContent: "space-between", color: "#8696a0", fontSize: "0.85rem", marginTop: 2 }}>
                            <span className="preview" style={{ fontWeight: 400, opacity: 0.8 }}>
                                {role === 'END_USER' 
                                    ? (c.AssignedUserName ? `Técnico: ${c.AssignedUserName}` : "Aguardando técnico...")
                                    : (c.Title && c.Title !== c.ContactName ? c.Title : formatPhone(c.ExternalUserId))
                                }
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                {c.UnreadCount > 0 && (
                                    <span className="unread-badge" style={{ background: "var(--primary)", color: "white", borderRadius: "50%", padding: "2px 6px", fontSize: "0.7rem" }}>{c.UnreadCount}</span>
                                )}
                                <span className="time">{formatTime(c.LastMessageAt)}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {displayedConversations.length === 0 && (
                    <div style={{ padding: 20, textAlign: "center", color: "#8696a0" }}>
                        Nenhuma conversa encontrada
                    </div>
                )}
            </div>

            {showNewChatModal && (
                <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 30, borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", border: "1px solid var(--border)", animation: "modalIn 0.3s ease-out" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(0, 168, 132, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#00a884" }}>
                                    <MessageSquare size={22} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Nova Conversa</h3>
                            </div>
                            <button onClick={() => setShowNewChatModal(false)} className="icon-btn" style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-secondary)", cursor: "pointer", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Plus size={24} style={{ transform: "rotate(45deg)" }} />
                            </button>
                        </div>

                        <div style={{ position: "relative", marginBottom: 20 }}>
                            <Search size={18} color="#8696a0" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
                            <input 
                                placeholder="Buscar contato por nome ou telefone..." 
                                value={contactSearch} 
                                onChange={e => setContactSearch(e.target.value)}
                                style={{ width: "100%", padding: "14px 14px 14px 48px", borderRadius: 12, border: "2px solid transparent", background: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box", fontSize: "1rem", outline: "none", transition: "all 0.2s" }}
                                onFocus={e => e.target.style.borderColor = "#00a884"}
                                onBlur={e => e.target.style.borderColor = "transparent"}
                                autoFocus
                            />
                        </div>

                        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 15, paddingRight: 5 }}>
                            {/* Seção de Usuários Internos */}
                            {internalUsers.filter(u => u.UserId !== userId && (u.Name || "").toLowerCase().includes(contactSearch.toLowerCase())).length > 0 && (
                                <div>
                                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#00a884", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, paddingLeft: 8 }}>Equipe</div>
                                    {internalUsers.filter(u => u.UserId !== userId && (u.Name || "").toLowerCase().includes(contactSearch.toLowerCase())).map(u => (
                                        <div key={u.UserId} onClick={() => handleStartChat({ UserId: u.UserId })} style={{ padding: "10px 16px", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#00a884", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "white", fontSize: "0.9rem" }}>
                                                {(u.Name || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{u.Name}</div>
                                                <div style={{ fontSize: "0.75rem", color: "#8696a0" }}>Usuário Interno</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Seção de Contatos Externos */}
                            <div>
                                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8696a0", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, paddingLeft: 8 }}>Contatos Externos</div>
                                {contacts.filter(c => (c.Name || "").toLowerCase().includes(contactSearch.toLowerCase()) || (c.Phone || "").includes(contactSearch)).map(contact => (
                                    <div key={contact.ContactId} onClick={() => handleStartChat(contact)} style={{ padding: "10px 16px", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                                            {(contact.Name || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{contact.Name || "Sem Nome"}</div>
                                            <div style={{ fontSize: "0.75rem", color: "#8696a0" }}>{contact.Phone}</div>
                                        </div>
                                    </div>
                                ))}
                                {contacts.length === 0 && internalUsers.length === 0 && (
                                    <div style={{ textAlign: "center", color: "#8696a0", padding: 20 }}>Nenhum resultado encontrado.</div>
                                )}
                            </div>
                        </div>

                        <div style={{ marginTop: 25, paddingTop: 20, borderTop: "1px solid var(--border)", textAlign: "center" }}>
                            <button onClick={() => setView("CONTACTS")} className="btn btn-ghost" style={{ fontSize: "0.9rem", width: "100%", padding: "12px", borderRadius: 12 }}>
                                Gerenciar Contatos
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

