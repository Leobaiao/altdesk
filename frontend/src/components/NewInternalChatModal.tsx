import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { X, Search } from "lucide-react";
import { getUserIdFromToken } from "../lib/auth";

interface User {
    UserId: string;
    Name: string;
    Email: string;
    Role: string;
    AgentName?: string;
}

export function NewInternalChatModal({ 
    onClose, 
    onSuccess 
}: { 
    onClose: () => void, 
    onSuccess: (conversationId: string) => void 
}) {
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const myUserId = getUserIdFromToken();

    useEffect(() => {
        // Fetch all users
        api.get("/api/users?agentsOnly=false").then(res => {
            const filtered = res.data.filter((u: User) => u.UserId !== myUserId);
            setUsers(filtered);
        }).catch(err => {
            console.error("Failed to fetch users", err);
        });
    }, [myUserId]);

    const handleCreateChat = async (targetUserId: string) => {
        try {
            setLoading(true);
            const res = await api.post("/api/conversations/internal", { targetUserId });
            onSuccess(res.data.conversationId);
        } catch (err: any) {
            alert("Erro ao criar chat interno: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const displayedUsers = users.filter(u => 
        u.Name?.toLowerCase().includes(search.toLowerCase()) || 
        u.AgentName?.toLowerCase().includes(search.toLowerCase()) || 
        u.Email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center"
        }}>
            <div style={{
                background: "var(--bg-primary)",
                width: 400,
                borderRadius: 12,
                display: "flex", flexDirection: "column",
                boxShadow: "0 8px 30px rgba(0,0,0,0.2)"
            }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Nova Conversa Interna</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ position: "relative" }}>
                        <Search size={18} color="var(--text-secondary)" style={{ position: "absolute", left: 12, top: 11 }} />
                        <input 
                            placeholder="Buscar agente ou colaborador..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ 
                                width: "100%", padding: "10px 10px 10px 38px", 
                                borderRadius: 8, border: "1px solid var(--border)",
                                background: "var(--bg-secondary)", color: "var(--text-primary)",
                                outline: "none"
                            }} 
                        />
                    </div>

                    <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                        {displayedUsers.length === 0 && (
                            <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20 }}>
                                Nenhum usuário encontrado.
                            </div>
                        )}
                        {displayedUsers.map(u => (
                            <button
                                key={u.UserId}
                                onClick={() => handleCreateChat(u.UserId)}
                                disabled={loading}
                                style={{
                                    display: "flex", flexDirection: "column", gap: 4,
                                    padding: 12, borderRadius: 8, border: "1px solid var(--border)",
                                    background: "transparent", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                    {u.AgentName || u.Name || "Agente"}
                                </span>
                                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                    {u.Email} - {u.Role}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
