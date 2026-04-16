import React, { useEffect } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export type ToastProps = {
    message: string;
    type?: ToastType;
    onClose: () => void;
    duration?: number;
    action?: { label: string; onClick: () => void };
};

export function Toast({ message, type = "info", onClose, duration = 4000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const styles = {
        success: { bg: "#00a884", icon: <CheckCircle size={18} />, label: "Sucesso" },
        error: { bg: "#ea4335", icon: <AlertCircle size={18} />, label: "Erro" },
        info: { bg: "#4285f4", icon: <Info size={18} />, label: "Aviso" }
    }[type];

    return (
        <div style={{
            minWidth: 320,
            maxWidth: 450,
            background: "rgba(11, 20, 26, 0.4)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#fff",
            padding: "16px 20px",
            borderRadius: 16,
            zIndex: 1000,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            animation: "slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            position: "relative",
            overflow: "hidden"
        }}>
            {/* Progress Bar Background */}
            <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                height: 3,
                width: "100%",
                background: "rgba(255,255,255,0.1)"
            }} />
            
            {/* Progress Bar Active */}
            <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                height: 3,
                background: styles.bg,
                animation: `shrinkWidth ${duration}ms linear forwards`
            }} />

            <div style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: `${styles.bg}25`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: styles.bg,
                flexShrink: 0
            }}>
                {styles.icon}
            </div>

            <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: styles.bg, marginBottom: 2 }}>{styles.label}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 500, lineHeight: 1.4, color: "var(--text-primary)" }}>{message}</div>
            </div>

            <button
                onClick={onClose}
                style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.3)",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "color 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
            >
                <X size={16} />
            </button>
        </div>
    );
}
