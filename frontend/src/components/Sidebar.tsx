import React, { useState, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { useChat } from "../contexts/ChatContext";
import type { Conversation } from "../../../shared/types";

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

export function Sidebar({ setView }: { setView: (view: any) => void }) {
    const { conversations, selectedConversationId, setSelectedConversationId } = useChat();
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

    const userId = getUserIdFromToken();
    const myChats = conversations.filter(c => c.Status === "OPEN" && c.AssignedUserId === userId);
    const queueChats = conversations.filter(c => c.Status === "OPEN" && !c.AssignedUserId);
    const allChats = conversations.filter(c => c.Status === "OPEN");
    const resolvedChats = conversations.filter(c => c.Status === "RESOLVED");

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
            <div className="sidebar-header" style={{ padding: "10px 15px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Conversas</h2>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setView("CONTACTS")} title="Novo Chat" style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <Plus size={20} color="#00a884" />
                    </button>
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
                <TabButton label="Filas" active={tab === "QUEUE"} onClick={() => setTab("QUEUE")} />
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
                            <span className="title" style={{ fontWeight: 600 }}>{c.Title || formatPhone(c.ExternalUserId)}</span>
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
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
                        <div className="meta" style={{ display: "flex", justifyContent: "space-between", color: "#8696a0", fontSize: "0.85rem", marginTop: 4 }}>
                            <span className="preview">{formatPhone(c.ExternalUserId)}</span>
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
        </div>
    );
}
