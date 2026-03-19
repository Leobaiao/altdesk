import { useEffect, useRef } from "react";

/**
 * Hook to request Web Push notification permission and show browser notifications
 * when a new message arrives in a conversation that is NOT currently focused.
 */
export function usePushNotifications(
    socket: any,
    selectedConversationId: string | null,
    conversations: any[]
) {
    const permissionRef = useRef<NotificationPermission>("default");

    // Request permission once on mount
    useEffect(() => {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            permissionRef.current = "granted";
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(perm => {
                permissionRef.current = perm;
            });
        } else {
            permissionRef.current = "denied";
        }
    }, []);

    // Listen to new message socket events
    useEffect(() => {
        if (!socket) return;

        const onNewMessage = (m: any) => {
            // Only notify if:
            // 1. Direction is IN (incoming from customer)
            // 2. Conversation is NOT the currently selected one
            // 3. Permission is granted
            // 4. Browser tab is not focused
            if (
                m.direction !== "IN" ||
                m.conversationId === selectedConversationId ||
                permissionRef.current !== "granted"
            ) return;

            const conv = conversations.find(c => c.ConversationId === m.conversationId);
            const title = conv?.Title || conv?.ExternalUserId || "Nova mensagem";
            const body = m.text || "Você recebeu uma nova mensagem.";

            // Only notify when document is not focused
            if (!document.hasFocus()) {
                const notification = new Notification(`💬 ${title}`, {
                    body,
                    icon: "/favicon.ico",
                    tag: m.conversationId, // Replace previous notification for same conv
                    badge: "/favicon.ico",
                });

                // Click brings focus and selects conversation
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                // Auto-close after 5 seconds
                setTimeout(() => notification.close(), 5000);
            }

            // Also update document title with unread indicator
            document.title = `(●) AltDesk - Nova mensagem`;
        };

        const onFocus = () => {
            // Clear document title badge when window is focused
            document.title = "AltDesk";
        };

        socket.on("message:new", onNewMessage);
        window.addEventListener("focus", onFocus);

        return () => {
            socket.off("message:new", onNewMessage);
            window.removeEventListener("focus", onFocus);
        };
    }, [socket, selectedConversationId, conversations]);
}
