import React, { createContext, useContext, useState, useCallback } from "react";
import { Toast, ToastType } from "../components/Toast";

interface Notification {
    id: number;
    message: string;
    type: ToastType;
}

interface NotificationContextData {
    notify: (message: string, type?: ToastType) => void;
}

const NotificationContext = createContext<NotificationContextData>({} as NotificationContextData);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const notify = useCallback((message: string, type: ToastType = "info") => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
    }, []);

    const remove = useCallback((id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ notify }}>
            {children}
            <div style={{
                position: "fixed",
                bottom: 24,
                right: 24,
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                pointerEvents: "none"
            }}>
                {notifications.map(n => (
                    <div key={n.id} style={{ pointerEvents: "auto" }}>
                        <Toast
                            message={n.message}
                            type={n.type}
                            onClose={() => remove(n.id)}
                        />
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    return useContext(NotificationContext);
}
