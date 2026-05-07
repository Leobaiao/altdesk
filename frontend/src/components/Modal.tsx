import React from "react";
import { X } from "lucide-react";

interface ModalProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    onClose: () => void;
    maxWidth?: number | string;
    footer?: React.ReactNode;
}

export function Modal({ title, description, children, onClose, maxWidth = 500, footer }: ModalProps) {
    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 3000, padding: 20
        }}>
            <div style={{
                background: "var(--bg-secondary)",
                padding: 30,
                borderRadius: 20,
                width: "100%",
                maxWidth: maxWidth,
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                display: "flex",
                flexDirection: "column",
                gap: 15
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "1.4rem", color: "var(--text-primary)" }}>{title}</h2>
                        {description && (
                            <p style={{ margin: "5px 0 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                                {description}
                            </p>
                        )}
                    </div>
                    <button 
                        onClick={onClose}
                        style={{ 
                            background: "none", border: "none", color: "var(--text-secondary)", 
                            cursor: "pointer", padding: 5, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                        className="btn-ghost"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                    {children}
                </div>

                {footer && (
                    <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

interface ConfirmModalProps {
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    loading?: boolean;
}

export function ConfirmModal({ 
    title, description, onConfirm, onCancel, 
    confirmLabel = "Confirmar", cancelLabel = "Cancelar", 
    isDanger = false, loading = false 
}: ConfirmModalProps) {
    return (
        <Modal title={title} description={description} onClose={onCancel} maxWidth={400} footer={
            <>
                <button 
                    onClick={onCancel}
                    disabled={loading}
                    style={{ 
                        flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--border)", 
                        background: "transparent", color: "var(--text-primary)", 
                        cursor: "pointer", fontWeight: 600 
                    }}
                >
                    {cancelLabel}
                </button>
                <button 
                    onClick={onConfirm}
                    disabled={loading}
                    style={{ 
                        flex: 1, padding: 12, borderRadius: 10, border: "none", 
                        background: isDanger ? "var(--danger, #ef4444)" : "var(--accent)", 
                        color: "white", cursor: "pointer", fontWeight: 700 
                    }}
                >
                    {loading ? "Processando..." : confirmLabel}
                </button>
            </>
        }>
            <div />
        </Modal>
    );
}
