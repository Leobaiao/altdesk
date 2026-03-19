import React from "react";
import { X } from "lucide-react";
import type { Tag } from "../../../shared/types";

interface TagPillProps {
    tag: Tag;
    onRemove?: (tagId: string) => void;
    size?: "sm" | "md";
}

export function TagPill({ tag, onRemove, size = "md" }: TagPillProps) {
    const isDark = (color: string) => {
        // Basic brightness check to pick text color
        const c = color.substring(1);
        const rgb = parseInt(c, 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luma < 128;
    };

    const textColor = isDark(tag.Color) ? "#FFFFFF" : "#111b21";

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                backgroundColor: tag.Color,
                color: textColor,
                padding: size === "sm" ? "1px 6px" : "2px 8px",
                borderRadius: 12,
                fontSize: size === "sm" ? "0.65rem" : "0.75rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
            }}
        >
            {tag.Name}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(tag.TagId);
                    }}
                    style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "inherit",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        opacity: 0.7
                    }}
                >
                    <X size={12} />
                </button>
            )}
        </span>
    );
}
