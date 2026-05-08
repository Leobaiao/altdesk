import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
}

export function ConfirmModal({
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    variant = "danger"
}: ConfirmModalProps) {
    const variantColor = variant === "danger" ? "var(--danger)" : variant === "warning" ? "#ff9800" : "var(--accent)";
    const variantBg = variant === "danger" ? "rgba(234,67,53,0.1)" : variant === "warning" ? "rgba(255,152,0,0.1)" : "rgba(0,168,132,0.1)";

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
            padding: 20
        }} onClick={onCancel}>
            <div style={{
                background: "var(--bg-secondary)",
                borderRadius: 24,
                border: "1px solid var(--border)",
                maxWidth: 400,
                width: "100%",
                padding: 32,
                position: "relative",
                animation: "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                boxShadow: "0 30px 60px rgba(0,0,0,0.5)"
            }} onClick={e => e.stopPropagation()}>
                
                <button onClick={onCancel} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.05)", border: "none", color: "var(--text-secondary)", cursor: "pointer", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={18} />
                </button>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                    <div style={{ 
                        width: 64, 
                        height: 64, 
                        borderRadius: 20, 
                        background: variantBg, 
                        display: "flex", 
                        alignItems: "center", 
                        justifyChild: "center", 
                        color: variantColor,
                        marginBottom: 20,
                        display: "flex",
                        justifyContent: "center"
                    }}>
                        <AlertTriangle size={32} />
                    </div>

                    <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>{title}</h3>
                    <p style={{ marginTop: 12, marginBottom: 32, color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.5 }}>
                        {message}
                    </p>

                    <div style={{ display: "flex", gap: 12, width: "100%" }}>
                        <button 
                            onClick={onCancel} 
                            style={{ 
                                flex: 1, 
                                height: 48, 
                                borderRadius: 12, 
                                border: "1px solid var(--border)", 
                                background: "transparent", 
                                color: "var(--text-primary)", 
                                fontWeight: 700, 
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                        >
                            {cancelLabel}
                        </button>
                        <button 
                            onClick={onConfirm} 
                            style={{ 
                                flex: 1, 
                                height: 48, 
                                borderRadius: 12, 
                                border: "none", 
                                background: variant === "danger" ? "var(--danger)" : variantColor, 
                                color: "#fff", 
                                fontWeight: 700, 
                                cursor: "pointer",
                                boxShadow: `0 8px 16px ${variant === "danger" ? "rgba(234,67,53,0.2)" : "rgba(0,168,132,0.2)"}`,
                                transition: "all 0.2s"
                            }}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
