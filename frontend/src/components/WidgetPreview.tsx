import React from "react";

/**
 * WidgetPreview — Componente que renderiza uma réplica visual do widget
 * com as configurações atuais do formulário. Função pura de `config`.
 * Não tem estado próprio — o que está na tela é o que vai pro banco.
 */
interface WidgetConfig {
    corPrimaria?: string;
    corFundo?: string;
    corTexto?: string;
    avatarUrl?: string;
    launcherFormato?: string;
    posicao?: string;
    tema?: string;
    fonte?: string;
    animacoesAtivas?: boolean;
    mensagemBoasVindas?: string;
    mensagemForaHorario?: string;
    exigirEmail?: boolean;
    exigirNome?: boolean;
    exigirTelefone?: boolean;
    textoConsentimentoLgpd?: string;
    quickReplies?: Array<{ label: string; action?: string }>;
}

export function WidgetPreview({ config }: { config: WidgetConfig }) {
    const {
        corPrimaria = "#6C63FF",
        corFundo = "#FFFFFF",
        corTexto = "#1A1A2E",
        avatarUrl,
        launcherFormato = "circle",
        posicao = "bottom-right",
        fonte = "Inter",
        mensagemBoasVindas = "Olá! Como podemos ajudar?",
        exigirEmail = false,
        exigirNome = false,
        exigirTelefone = false,
        textoConsentimentoLgpd = "",
        quickReplies = []
    } = config;

    const isLeft = posicao === "bottom-left";
    const isDark = config.tema === "dark";
    const bgColor = isDark ? "#1A1A2E" : corFundo;
    const textColor = isDark ? "#E0E0E0" : corTexto;
    const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
    const inputBg = isDark ? "rgba(255,255,255,0.06)" : "#F5F6FA";
    const hasPreChatForm = exigirNome || exigirEmail || exigirTelefone;

    return (
        <div style={{
            position: "relative",
            width: "100%",
            height: "100%",
            minHeight: 540,
            background: isDark ? "#0F0F1A" : "#F0F2F5",
            borderRadius: 16,
            overflow: "hidden",
            fontFamily: `'${fonte}', Inter, sans-serif`,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: isLeft ? "flex-start" : "flex-end",
            padding: 20
        }}>
            {/* Fundo simulado de site */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 50,
                background: isDark ? "#16162B" : "#FFFFFF",
                borderBottom: `1px solid ${borderColor}`,
                display: "flex", alignItems: "center", padding: "0 20px", gap: 8
            }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F56" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27C93F" }} />
                <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: isDark ? "#888" : "#999", fontWeight: 500 }}>
                    seusite.com.br
                </div>
            </div>

            {/* Painel de chat */}
            <div style={{
                width: 320,
                height: 440,
                background: bgColor,
                borderRadius: 16,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
                border: `1px solid ${borderColor}`,
                transition: "all 0.3s ease"
            }}>
                {/* Header */}
                <div style={{
                    background: corPrimaria,
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12
                }}>
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" style={{
                            width: 36, height: 36, borderRadius: "50%",
                            objectFit: "cover", border: "2px solid rgba(255,255,255,0.3)"
                        }} />
                    ) : (
                        <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: "rgba(255,255,255,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, color: "#fff", fontWeight: 700
                        }}>💬</div>
                    )}
                    <div>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Fale Conosco</div>
                        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
                            <span style={{
                                display: "inline-block", width: 6, height: 6,
                                borderRadius: "50%", background: "#4ADE80",
                                marginRight: 5, verticalAlign: "middle"
                            }} />
                            Online agora
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div style={{
                    flex: 1,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    overflowY: "auto"
                }}>
                    {/* LGPD Consent */}
                    {textoConsentimentoLgpd && (
                        <div style={{
                            background: isDark ? "rgba(108,99,255,0.1)" : "rgba(108,99,255,0.06)",
                            border: `1px solid ${isDark ? "rgba(108,99,255,0.2)" : "rgba(108,99,255,0.15)"}`,
                            borderRadius: 10, padding: "10px 12px",
                            fontSize: 11, color: isDark ? "#B0B0C0" : "#666",
                            lineHeight: 1.4
                        }}>
                            🔒 {textoConsentimentoLgpd}
                        </div>
                    )}

                    {/* Welcome Message */}
                    <div style={{
                        maxWidth: "85%",
                        padding: "10px 14px",
                        borderRadius: "14px 14px 14px 4px",
                        fontSize: 13,
                        color: textColor,
                        background: inputBg,
                        lineHeight: 1.4
                    }}>
                        {mensagemBoasVindas}
                    </div>

                    {/* Quick Replies */}
                    {quickReplies.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {quickReplies.map((qr, i) => (
                                <div key={i} style={{
                                    padding: "6px 12px",
                                    borderRadius: 20,
                                    border: `1px solid ${corPrimaria}`,
                                    color: corPrimaria,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer"
                                }}>
                                    {qr.label}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pre-Chat Form */}
                    {hasPreChatForm && (
                        <div style={{
                            background: inputBg, borderRadius: 12,
                            padding: 14, display: "flex", flexDirection: "column", gap: 8,
                            border: `1px solid ${borderColor}`
                        }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: textColor, marginBottom: 2 }}>
                                Antes de conversar, precisamos de:
                            </div>
                            {exigirNome && (
                                <input
                                    readOnly
                                    placeholder="Seu nome"
                                    style={{
                                        padding: "8px 10px", borderRadius: 8, fontSize: 12,
                                        border: `1px solid ${borderColor}`,
                                        background: bgColor, color: textColor,
                                        outline: "none"
                                    }}
                                />
                            )}
                            {exigirEmail && (
                                <input
                                    readOnly
                                    placeholder="Seu email"
                                    style={{
                                        padding: "8px 10px", borderRadius: 8, fontSize: 12,
                                        border: `1px solid ${borderColor}`,
                                        background: bgColor, color: textColor,
                                        outline: "none"
                                    }}
                                />
                            )}
                            {exigirTelefone && (
                                <input
                                    readOnly
                                    placeholder="Seu telefone"
                                    style={{
                                        padding: "8px 10px", borderRadius: 8, fontSize: 12,
                                        border: `1px solid ${borderColor}`,
                                        background: bgColor, color: textColor,
                                        outline: "none"
                                    }}
                                />
                            )}
                            <button style={{
                                background: corPrimaria, color: "#fff",
                                border: "none", borderRadius: 8,
                                padding: "8px 0", fontSize: 12, fontWeight: 700,
                                cursor: "pointer"
                            }}>
                                Iniciar conversa
                            </button>
                        </div>
                    )}

                    {/* Sample user message */}
                    <div style={{
                        maxWidth: "75%",
                        padding: "10px 14px",
                        borderRadius: "14px 14px 4px 14px",
                        fontSize: 13,
                        color: "#fff",
                        background: corPrimaria,
                        alignSelf: "flex-end",
                        lineHeight: 1.4
                    }}>
                        Olá, preciso de ajuda!
                    </div>
                </div>

                {/* Input Area */}
                <div style={{
                    display: "flex", gap: 8, padding: 12,
                    borderTop: `1px solid ${borderColor}`,
                    alignItems: "center"
                }}>
                    <input
                        readOnly
                        placeholder="Digite sua mensagem..."
                        style={{
                            flex: 1, border: `1px solid ${borderColor}`,
                            borderRadius: 10, padding: "10px 12px",
                            fontSize: 13, background: inputBg,
                            color: textColor, outline: "none"
                        }}
                    />
                    <button style={{
                        background: corPrimaria, color: "#fff",
                        border: "none", borderRadius: 10,
                        padding: "10px 16px", fontWeight: 700,
                        fontSize: 13, cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}>
                        Enviar
                    </button>
                </div>
            </div>

            {/* Launcher Bubble */}
            <div style={{
                position: "absolute",
                bottom: 20,
                [isLeft ? "left" : "right"]: 20,
                width: launcherFormato === "pill" ? "auto" : 56,
                height: 56,
                borderRadius: launcherFormato === "circle" ? "50%" : launcherFormato === "pill" ? 28 : 16,
                background: corPrimaria,
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
                display: "none", // Escondido porque o painel está aberto
                alignItems: "center",
                justifyContent: "center",
                padding: launcherFormato === "pill" ? "0 20px" : 0
            }}>
                <svg viewBox="0 0 24 24" width={24} height={24} fill="#fff">
                    <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
                </svg>
            </div>
        </div>
    );
}
