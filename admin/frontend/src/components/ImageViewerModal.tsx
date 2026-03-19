import React, { useEffect } from "react";
import { X, ZoomIn, ZoomOut, Download } from "lucide-react";

interface ImageViewerModalProps {
    src: string;
    onClose: () => void;
}

export function ImageViewerModal({ src, onClose }: ImageViewerModalProps) {
    // Close on ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    return (
        <div
            className="media-modal-backdrop"
            onClick={onClose}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10000,
                cursor: "zoom-out",
                padding: "40px"
            }}
        >
            <div
                className="media-modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: "relative",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "default"
                }}
            >
                <div style={{
                    position: "absolute",
                    top: -40,
                    right: 0,
                    display: "flex",
                    gap: "15px"
                }}>
                    <a
                        href={src}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "white", opacity: 0.8, transition: "opacity 0.2s" }}
                        title="Download"
                    >
                        <Download size={24} />
                    </a>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "white",
                            cursor: "pointer",
                            padding: 0,
                            opacity: 0.8,
                            transition: "opacity 0.2s"
                        }}
                        title="Fechar (Esc)"
                    >
                        <X size={24} />
                    </button>
                </div>

                <img
                    src={src}
                    alt="Visualização"
                    style={{
                        maxWidth: "100%",
                        maxHeight: "85vh",
                        borderRadius: "8px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                        objectFit: "contain"
                    }}
                />
            </div>
        </div>
    );
}
