import React, { useEffect, useRef } from "react";
import { X, HelpCircle, BookOpen, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import DOMPurify from "dompurify";
import { useHelp } from "../contexts/HelpContext";

export function HelpDrawer() {
    const { isOpen, loading, article, closeHelp } = useHelp();
    const contentRef = useRef<HTMLDivElement>(null);

    // Scroll to top when new article loads
    useEffect(() => {
        if (article && contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [article]);

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) closeHelp();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, closeHelp]);

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    const isFallback = article?.HelpArticleId === "fallback";

    return (
        <>
            {/* Backdrop with animated fade */}
            <div
                onClick={closeHelp}
                className="help-drawer-backdrop"
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                    zIndex: 99998,
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? "auto" : "none",
                    transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
            />

            {/* Sliding Drawer */}
            <aside
                className="help-drawer"
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    height: "100%",
                    width: "min(480px, 100vw)",
                    zIndex: 99999,
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    borderLeft: "1px solid var(--border)",
                    transform: isOpen ? "translateX(0)" : "translateX(100%)",
                    transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
                    boxShadow: isOpen ? "-8px 0 40px rgba(0, 0, 0, 0.3)" : "none",
                }}
                aria-hidden={!isOpen}
                role="dialog"
                aria-label="Painel de Ajuda"
            >
                {/* ─── Header ─── */}
                <div style={{
                    padding: "20px 24px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--bg-primary)",
                    flexShrink: 0,
                    position: "relative",
                    overflow: "hidden"
                }}>
                    {/* Decorative accent glow */}
                    <div style={{
                        position: "absolute",
                        top: -30,
                        left: -30,
                        width: 120,
                        height: 120,
                        background: "radial-gradient(circle, rgba(0,168,132,0.12) 0%, transparent 70%)",
                        pointerEvents: "none"
                    }} />

                    <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 1 }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: "rgba(0,168,132,0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}>
                            <HelpCircle size={20} color="var(--accent)" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.3px" }}>
                                Central de Ajuda
                            </h2>
                            <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                                Suporte e documentação da tela
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={closeHelp}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "var(--bg-hover)",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s",
                            flexShrink: 0,
                            position: "relative",
                            zIndex: 1
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = "var(--danger)";
                            e.currentTarget.style.color = "#fff";
                            e.currentTarget.style.borderColor = "var(--danger)";
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = "var(--bg-hover)";
                            e.currentTarget.style.color = "var(--text-secondary)";
                            e.currentTarget.style.borderColor = "var(--border)";
                        }}
                        title="Fechar ajuda (Esc)"
                        aria-label="Fechar painel de ajuda"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                {/* ─── Content Area ─── */}
                <div
                    ref={contentRef}
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {loading ? (
                        /* ─── Loading State ─── */
                        <div style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 16,
                            padding: 40,
                        }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                background: "rgba(0,168,132,0.08)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                animation: "helpPulse 2s ease-in-out infinite"
                            }}>
                                <Loader2 size={24} color="var(--accent)" style={{ animation: "spin 1s linear infinite" }} />
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                    Carregando conteúdo...
                                </p>
                                <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                    Buscando a documentação desta tela
                                </p>
                            </div>
                        </div>
                    ) : article && !isFallback ? (
                        /* ─── Article Content ─── */
                        <div style={{ animation: "helpSlideUp 0.3s ease-out" }}>
                            {/* Category + Context Badge Bar */}
                            <div style={{
                                padding: "16px 24px",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                                borderBottom: "1px solid var(--border)",
                                background: "var(--bg-primary)"
                            }}>
                                {article.Category && (
                                    <span style={{
                                        fontSize: "0.68rem",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.08em",
                                        fontWeight: 700,
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        background: "rgba(0,168,132,0.1)",
                                        color: "var(--accent)",
                                        border: "1px solid rgba(0,168,132,0.15)"
                                    }}>
                                        {article.Category}
                                    </span>
                                )}
                                {article.PagePath && (
                                    <a href={article.PagePath} style={{
                                        fontSize: "0.68rem",
                                        fontWeight: 500,
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        background: "var(--bg-hover)",
                                        color: "var(--text-secondary)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        textDecoration: "none"
                                    }}>
                                        <ChevronRight size={10} />
                                        Ir para {article.PagePath}
                                    </a>
                                )}
                            </div>

                            {/* Title */}
                            <div style={{ padding: "24px 24px 0" }}>
                                <h1 style={{
                                    margin: 0,
                                    fontSize: "1.4rem",
                                    fontWeight: 800,
                                    lineHeight: 1.25,
                                    letterSpacing: "-0.5px",
                                    color: "var(--text-primary)"
                                }}>
                                    {article.Title}
                                </h1>
                            </div>

                            {/* Divider */}
                            <div style={{
                                margin: "20px 24px",
                                height: 1,
                                background: "var(--border)",
                                opacity: 0.6
                            }} />

                            {/* Rich Content */}
                            <div 
                                className="help-drawer-content tiptap"
                                style={{ padding: "0 24px 32px" }}
                            >
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html: DOMPurify.sanitize(article.Content)
                                    }}
                                    style={{
                                        fontSize: "0.92rem",
                                        lineHeight: 1.75,
                                        color: "var(--text-primary)",
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        /* ─── Empty / Fallback State ─── */
                        <div style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 16,
                            padding: "40px 32px",
                            textAlign: "center"
                        }}>
                            <div style={{
                                width: 72,
                                height: 72,
                                borderRadius: 20,
                                background: "var(--bg-hover)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "1px solid var(--border)"
                            }}>
                                <AlertCircle size={32} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
                            </div>
                            <div>
                                <p style={{
                                    margin: 0,
                                    fontSize: "1.05rem",
                                    fontWeight: 700,
                                    color: "var(--text-primary)"
                                }}>
                                    Ajuda Indisponível
                                </p>
                                <p style={{
                                    margin: "8px 0 0",
                                    fontSize: "0.85rem",
                                    color: "var(--text-secondary)",
                                    lineHeight: 1.5,
                                    maxWidth: 280
                                }}>
                                    Ainda não há conteúdo de ajuda registrado para esta tela.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Footer ─── */}
                <div style={{
                    padding: "16px 24px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    background: "var(--bg-primary)",
                    flexShrink: 0,
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "var(--text-secondary)",
                        fontSize: "0.75rem",
                    }}>
                        <BookOpen size={14} style={{ opacity: 0.7 }} />
                        <span>Ainda com dúvidas? Fale com o seu supervisor.</span>
                    </div>
                    <button
                        onClick={closeHelp}
                        style={{
                            padding: "8px 20px",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--bg-hover)",
                            color: "var(--text-primary)",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = "var(--accent)";
                            e.currentTarget.style.color = "#fff";
                            e.currentTarget.style.borderColor = "var(--accent)";
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = "var(--bg-hover)";
                            e.currentTarget.style.color = "var(--text-primary)";
                            e.currentTarget.style.borderColor = "var(--border)";
                        }}
                    >
                        Entendi
                    </button>
                </div>
            </aside>

            {/* Scoped CSS injected only once */}
            <style>{`
                @keyframes helpSlideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes helpPulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Help Drawer Content Styling */
                .help-drawer-content h1,
                .help-drawer-content h2,
                .help-drawer-content h3,
                .help-drawer-content h4 {
                    color: var(--text-primary);
                    font-weight: 700;
                    line-height: 1.3;
                    letter-spacing: -0.3px;
                }
                .help-drawer-content h2 {
                    font-size: 1.15rem;
                    margin: 24px 0 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--border);
                }
                .help-drawer-content h3 {
                    font-size: 0.95rem;
                    margin: 20px 0 8px;
                    color: var(--accent);
                }
                .help-drawer-content p {
                    margin: 0 0 12px;
                    color: var(--text-primary);
                    opacity: 0.9;
                }
                .help-drawer-content ul,
                .help-drawer-content ol {
                    padding-left: 20px;
                    margin: 8px 0 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .help-drawer-content li {
                    color: var(--text-primary);
                    opacity: 0.9;
                    line-height: 1.6;
                }
                .help-drawer-content li strong {
                    color: var(--text-primary);
                    opacity: 1;
                    font-weight: 700;
                }
                .help-drawer-content code {
                    background: var(--bg-hover);
                    border: 1px solid var(--border);
                    padding: 2px 7px;
                    border-radius: 5px;
                    font-size: 0.82em;
                    font-family: 'SF Mono', 'Fira Code', monospace;
                    color: var(--accent);
                }
                .help-drawer-content a {
                    color: var(--accent);
                    text-decoration: none;
                    font-weight: 600;
                }
                .help-drawer-content a:hover {
                    text-decoration: underline;
                }
                .help-drawer-content blockquote {
                    border-left: 3px solid var(--accent);
                    padding: 12px 16px;
                    margin: 16px 0;
                    background: rgba(0,168,132,0.05);
                    border-radius: 0 8px 8px 0;
                    font-style: italic;
                    color: var(--text-secondary);
                }
                .help-drawer-content img {
                    max-width: 100%;
                    border-radius: 8px;
                    margin: 12px 0;
                    border: 1px solid var(--border);
                }

                /* Scrollbar for drawer */
                .help-drawer::-webkit-scrollbar,
                .help-drawer > div::-webkit-scrollbar {
                    width: 5px;
                }
                .help-drawer::-webkit-scrollbar-thumb,
                .help-drawer > div::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 5px;
                }
                .help-drawer::-webkit-scrollbar-track,
                .help-drawer > div::-webkit-scrollbar-track {
                    background: transparent;
                }

                /* Mobile: full width drawer */
                @media (max-width: 640px) {
                    .help-drawer {
                        width: 100vw !important;
                    }
                }
            `}</style>
        </>
    );
}
