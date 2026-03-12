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
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

import { api } from "../lib/api";
import { parseJwt } from "../lib/auth";

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
        const newSocket = io(import.meta.env.VITE_API_URL || undefined, {
            auth: { token }
        });
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

        const onNew = (m: any) => {
            if (m.conversationId !== selectedConversationId) {
                // Only update sidebar for other conversations
                setConversations((prev) =>
                    prev.map((c) =>
                        c.ConversationId === m.conversationId
                            ? { ...c, LastMessageAt: new Date().toISOString(), UnreadCount: (c.UnreadCount || 0) + 1 }
                            : c
                    )
                );
                return;
            }

            if (m.direction === "OUT") {
                // Mensagens enviadas pelo agente: re-busca do banco para evitar duplicação
                // (o backend já salvou no DB antes de emitir o socket)
                fetchMessages();
            } else {
                // Mensagens recebidas (IN) e notas internas (INTERNAL): adiciona com deduplicação
                setMessages((prev) => {
                    // Deduplicação: evita mensagem duplicada com mesmo texto + direção em < 5 segundos
                    const isDuplicate = prev.some(
                        (p) =>
                            p.Body === m.text &&
                            p.Direction === (m.direction ?? "IN") &&
                            Math.abs(new Date(p.CreatedAt).getTime() - Date.now()) < 5000
                    );
                    if (isDuplicate) return prev;

                    return [
                        ...prev,
                        {
                            MessageId: m.messageId || crypto.randomUUID(),
                            Body: m.text,
                            Direction: m.direction ?? "IN",
                            SenderExternalId: m.senderExternalId ?? "",
                            MediaType: m.mediaType ?? undefined,
                            MediaUrl: m.mediaUrl ?? undefined,
                            Status: m.status ?? undefined,
                            CreatedAt: new Date().toISOString(),
                        } as Message,
                    ];
                });
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
                prev.map((msg) =>
                    msg.MessageId === data.messageId || (msg.Body && data.externalMessageId)
                        ? { ...msg, Status: data.status }
                        : msg
                )
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
