import React from "react";
import { FileText, Download, ExternalLink } from "lucide-react";

interface DocumentCardProps {
    url: string;
    name: string;
    direction: "IN" | "OUT";
}

export function DocumentCard({ url, name, direction }: DocumentCardProps) {
    const isOut = direction === "OUT";

    return (
        <div
            className={`document-card ${isOut ? 'out' : 'in'}`}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                backgroundColor: isOut ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 168, 132, 0.1)",
                borderRadius: "10px",
                marginTop: "6px",
                border: "1px solid",
                borderColor: isOut ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 168, 132, 0.2)",
                minWidth: "220px",
                maxWidth: "300px"
            }}
        >
            <div
                style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    backgroundColor: isOut ? "rgba(255,255,255,0.1)" : "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white"
                }}
            >
                <FileText size={22} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: "var(--text-primary)"
                    }}
                    title={name}
                >
                    {name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Documento
                </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: "var(--text-secondary)",
                        padding: "6px",
                        borderRadius: "6px",
                        transition: "all 0.2s"
                    }}
                    className="hover-bg"
                    title="Abrir"
                >
                    <ExternalLink size={18} />
                </a>
            </div>
        </div>
    );
}
