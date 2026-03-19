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

        return () => {
            newSocket.emit("tenant:leave", tenantId);
            newSocket.off("conversation:updated", onConvUpdated);
            newSocket.off("typing:start", onTypingStart);
            newSocket.off("typing:stop", onTypingStop);
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

        // De-duplication: track recent message fingerprints to avoid doubles
        // (emitConversationEvent sends to both conversation room AND tenant room)
        const recentMsgIds = new Set<string>();

        const onNew = (m: any) => {
            // If message is for THIS conversation, append it
            if (m.conversationId === selectedConversationId) {
                setMessages((prev) => [
                    ...prev.filter(msg => msg.MessageId !== m.MessageId), // Deduplication just in case
                    {
                        MessageId: m.MessageId || crypto.randomUUID(),
                        ExternalMessageId: m.ExternalMessageId,
                        Body: m.text,
                        Direction: m.direction ?? "IN",
                        SenderExternalId: m.senderExternalId ?? "",
                        MediaType: m.mediaType,
                        MediaUrl: m.mediaUrl,
                        CreatedAt: new Date().toISOString(),
                    },
                ]);
            }

            // Atualiza preview da sidebar
            setConversations((prev) =>
                prev.map((c) =>
                    c.ConversationId === m.conversationId
                        ? { ...c, LastMessageAt: new Date().toISOString(), UnreadCount: 0 }
                        : c
                )
            );
        };

        const onStatusUpdate = (data: any) => {
            if (data.conversationId !== selectedConversationId) return;
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

        socket.on("message:new", onNew);
        socket.on("message:status", onStatusUpdate);

        return () => {
            socket.emit("conversation:leave", selectedConversationId);
            socket.off("message:new", onNew);
            socket.off("message:status", onStatusUpdate);
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
            emitTyping
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
