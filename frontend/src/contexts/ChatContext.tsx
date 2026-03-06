import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
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
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

import { api } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// Helper
function parseJwt(token: string) {
    try { return JSON.parse(atob(token.split(".")[1])); } catch (e) { return null; }
}

export function ChatProvider({ children, token, onLogout }: { children: ReactNode, token: string, onLogout: () => void }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);


    const decoded = parseJwt(token);
    const tenantId = decoded?.tenantId;

    const refreshConversations = () => {
        api.get<Conversation[]>("/api/conversations")
            .then((res) => {
                if (Array.isArray(res.data)) {
                    setConversations(res.data);
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
        const newSocket = io(import.meta.env.VITE_API_URL || undefined);
        setSocket(newSocket);

        refreshConversations();

        newSocket.emit("tenant:join", tenantId);

        const onConvUpdated = () => refreshConversations();
        newSocket.on("conversation:updated", onConvUpdated);

        return () => {
            newSocket.emit("tenant:leave", tenantId);
            newSocket.off("conversation:updated", onConvUpdated);
            newSocket.disconnect();
        };
    }, [token, tenantId]);

    // 2. Load Messages when Conversation changes
    useEffect(() => {
        if (!selectedConversationId || !socket) return;

        // Clear old messages while loading
        setMessages([]);

        api.get<Message[]>(`/api/conversations/${selectedConversationId}/messages`)
            .then((res) => {
                if (Array.isArray(res.data)) {
                    setMessages(res.data);
                } else {
                    console.error("API returned non-array for messages:", res.data);
                    setMessages([]);
                }
            })
            .catch(console.error);

        socket.emit("conversation:join", selectedConversationId);

        // Global message listener
        const onNew = (m: any) => {
            // If message is for THIS conversation, append it
            if (m.conversationId === selectedConversationId) {
                setMessages((prev) => [
                    ...prev,
                    {
                        MessageId: crypto.randomUUID(),
                        Body: m.text,
                        Direction: m.direction ?? "IN",
                        SenderExternalId: m.senderExternalId ?? "",
                        MediaType: m.mediaType,
                        MediaUrl: m.mediaUrl,
                        CreatedAt: new Date().toISOString(),
                    },
                ]);
            }

            // Always update sidebar preview
            setConversations((prev) =>
                prev.map((c) =>
                    c.ConversationId === m.conversationId
                        ? { ...c, LastMessageAt: new Date().toISOString(), UnreadCount: c.ConversationId === selectedConversationId ? 0 : (c.UnreadCount || 0) + 1 }
                        : c
                )
            );
        };

        socket.on("message:new", onNew);
        return () => {
            socket.emit("conversation:leave", selectedConversationId);
            socket.off("message:new", onNew);
        };
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
            refreshConversations
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
