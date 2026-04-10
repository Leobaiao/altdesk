import React, { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

export type ToastProps = {
    message: string;
    type?: ToastType;
    onClose: () => void;
    duration?: number;
    action?: { label: string; onClick: () => void };
};

export function Toast({ message, type = "info", onClose, duration = 3000, action }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const bg = type === "success" ? "#00a884" : type === "error" ? "#ea4335" : "#333";

    return (
        <div 
            className="toast"
            style={{ background: bg }}
        >
            <span>{message}</span>
            {action && (
                <button
                    onClick={() => { action.onClick(); onClose(); }}
                    style={{
                        background: "rgba(255,255,255,0.2)",
                        border: "none",
                        borderRadius: 4,
                        padding: "5px 10px",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "0.9em"
                    }}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
