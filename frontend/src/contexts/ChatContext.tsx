import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import io, { Socket } from "socket.io-client";

import type { Conversation, Message } from "../../../shared/types";

type ChatContextType = {
    socket: Socket | null;
    conversations: Conversation[];
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
    selectedConversationId: string | null;
    setSelectedConversationId: React.Dispatch<React.SetStateAction<string | null>>;
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    refreshConversations: () => void;
    typingUsers: Record<string, string>; // conversationId → userName
    emitTyping: (conversationId: string, isTyping: boolean) => void;
    accountStatus: "TRIAL" | "ACTIVE" | null;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

import { api } from "../lib/api";
import { parseJwt } from "../lib/auth";

export function ChatProvider({ children, token, onLogout }: { children: ReactNode, token: string, onLogout: () => void }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
    const [accountStatus, setAccountStatus] = useState<"TRIAL" | "ACTIVE" | null>(null);

    // Ref to always have the latest selectedConversationId in socket listeners without re-subscribing
    const selectedConvIdRef = React.useRef<string | null>(null);
    useEffect(() => {
        selectedConvIdRef.current = selectedConversationId;
    }, [selectedConversationId]);

    const emitTyping = (conversationId: string, isTyping: boolean) => {
        if (!socket) return;
        socket.emit(isTyping ? "typing:start" : "typing:stop", { conversationId });
    };

    const decoded = parseJwt(token);
    const tenantId = decoded?.tenantId;

    const refreshConversations = () => {
        api.get<Conversation[]>("/api/conversations")
            .then((res) => {
                if (Array.isArray(res.data)) {
                    setConversations(prev => {
                        const serverIds = new Set(res.data.map(c => c.ConversationId));
                        // Prevent UI collapse by keeping any local conversations (like freshly created ones)
                        // that the server hasn't returned yet (e.g. because they fell out of the first page due to null LastMessageAt)
                        const optimistic = prev.filter(c => !serverIds.has(c.ConversationId));
                        
                        const merged = [...res.data, ...optimistic];
                        return merged.sort((a, b) => {
                            const dateA = new Date(a.LastMessageAt || a.CreatedAt || 0).getTime();
                            const dateB = new Date(b.LastMessageAt || b.CreatedAt || 0).getTime();
                            return dateB - dateA;
                        });
                    });
                }
            })
            .catch(err => {
                if (err.response?.status === 401) {
                    onLogout();
                }
                console.error(err);
            });
    };

    // 1. Initial Load & Socket Connection
    useEffect(() => {
        if (!tenantId) return;
        const newSocket = io(import.meta.env.VITE_API_URL || undefined, {
            auth: { token }
        });
        setSocket(newSocket);

        refreshConversations();

        // Buscar status da conta (Trial/Active)
        api.get("/api/billing/subscription")
            .then(res => {
                if (res.data && res.data.AccountStatus) {
                    setAccountStatus(res.data.AccountStatus);
                }
            })
            .catch(console.error);

        newSocket.emit("tenant:join", tenantId);

        const onConvUpdated = () => refreshConversations();
        newSocket.on("conversation:updated", onConvUpdated);

        const onTypingStart = ({ conversationId, userName }: { conversationId: string; userName: string }) => {
            setTypingUsers(prev => ({ ...prev, [conversationId]: userName }));
        };
        const onTypingStop = ({ conversationId }: { conversationId: string }) => {
            setTypingUsers(prev => {
                const next = { ...prev };
                delete next[conversationId];
                return next;
            });
        };
        newSocket.on("typing:start", onTypingStart);
        newSocket.on("typing:stop", onTypingStop);

        // --- Global Message Listeners ---
        const onNew = (m: any) => {
            const generateId = () => {
                if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
                    return window.crypto.randomUUID();
                }
                return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            };

            // 1. If message is for THE CURRENT OPEN conversation, append it
            if (m.conversationId === selectedConvIdRef.current) {
                setMessages((prev) => {
                    const exists = prev.some(msg => 
                        (m.MessageId && msg.MessageId === m.MessageId) || 
                        (m.ExternalMessageId && msg.ExternalMessageId === m.ExternalMessageId)
                    );
                    if (exists) return prev;

                    return [
                        ...prev,
                        {
                            MessageId: m.MessageId || generateId(),
                            ExternalMessageId: m.ExternalMessageId,
                            Body: m.text || m.Body || `[${m.mediaType || 'media'}]`,
                            Direction: m.direction || m.Direction || "IN",
                            SenderExternalId: m.senderExternalId || m.SenderExternalId || "",
                            MediaType: m.mediaType || m.MediaType,
                            MediaUrl: m.mediaUrl || m.MediaUrl,
                            CreatedAt: m.CreatedAt || new Date().toISOString(),
                        },
                    ];
                });
            }

            // 2. Update Sidebar (Conversations List)
            setConversations((prev) => {
                const exists = prev.some(c => c.ConversationId === m.conversationId);
                
                // If it's a completely NEW conversation (new contact), trigger a refresh
                if (!exists) {
                    refreshConversations();
                    return prev;
                }

                // If it exists, update it and move to the top
                const updatedList = prev.map((c) => {
                    if (c.ConversationId === m.conversationId) {
                        return { 
                            ...c, 
                            LastMessageAt: m.CreatedAt || new Date().toISOString(),
                            LastMessage: m.text || `[${m.mediaType || 'media'}]`,
                            UnreadCount: (c.UnreadCount || 0) + (selectedConvIdRef.current === m.conversationId ? 0 : 1) 
                        };
                    }
                    return c;
                });

                // Sort: Newest message at the top
                return updatedList.sort((a, b) => {
                    const dateA = new Date(a.LastMessageAt || 0).getTime();
                    const dateB = new Date(b.LastMessageAt || 0).getTime();
                    return dateB - dateA;
                });
            });
        };

        const onStatusUpdate = (data: any) => {
            setMessages((prev) =>
                prev.map((msg) => {
                    const matchById = msg.MessageId === data.messageId;
                    const matchByExternalId = !!(data.externalMessageId && msg.ExternalMessageId === data.externalMessageId);
                    if (matchById || matchByExternalId) {
                        return { ...msg, Status: data.status };
                    }
                    return msg;
                })
            );
        };

        newSocket.on("message:new", onNew);
        newSocket.on("message:status", onStatusUpdate);

        return () => {
            newSocket.emit("tenant:leave", tenantId);
            newSocket.off("conversation:updated", onConvUpdated);
            newSocket.off("typing:start", onTypingStart);
            newSocket.off("typing:stop", onTypingStop);
            newSocket.off("message:new", onNew);
            newSocket.off("message:status", onStatusUpdate);
            newSocket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, tenantId]);

    // 2. Load Messages when Conversation changes
    useEffect(() => {
        if (!selectedConversationId || !socket) return;

        // Clear old messages while loading
        setMessages([]);

        const fetchMessages = () => {
            api.get<Message[]>(`/api/conversations/${selectedConversationId}/messages`)
                .then((res) => {
                    if (Array.isArray(res.data)) {
                        setMessages(res.data);
                    } else {
                        setMessages([]);
                    }
                })
                .catch(console.error);
        };

        fetchMessages();
        socket.emit("conversation:join", selectedConversationId);

        return () => {
            socket.emit("conversation:leave", selectedConversationId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedConversationId, socket]);

    return (
        <ChatContext.Provider value={{
            socket,
            conversations,
            setConversations,
            selectedConversationId,
            setSelectedConversationId,
            messages,
            setMessages,
            refreshConversations,
            typingUsers,
            emitTyping,
            accountStatus
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error("useChat must be used within a ChatProvider");
    }
    return context;
}
