import React, { useState, useEffect, useCallback } from "react";
import { api } from "./lib/api";
import { WidgetPreview } from "./components/WidgetPreview";
import {
    Palette, MessageCircle, Clock, Shield, Globe, Code,
    Copy, Check, Save, Rocket, ChevronRight, Plus, Trash2, Eye
} from "lucide-react";

/**
 * WidgetSettings — Página completa de configuração do Chat Widget.
 * Layout split: formulário à esquerda, preview ao vivo à direita.
 * O preview é uma função pura de `config` — o que está na tela é o que vai pro banco.
 */

interface QuickReply {
    label: string;
    action?: string;
}

const TABS = [
    { key: "aparencia", label: "Aparência", icon: Palette },
    { key: "mensagens", label: "Mensagens", icon: MessageCircle },
    { key: "abertura", label: "Abertura", icon: Eye },
    { key: "identidade", label: "Identidade", icon: Shield },
    { key: "lgpd", label: "LGPD", icon: Shield },
    { key: "snippet", label: "Instalação", icon: Code },
] as const;

type TabKey = typeof TABS[number]["key"];

const FONTS = ["Inter", "Roboto", "Outfit", "Open Sans", "Poppins", "Lato", "Nunito"];
const LAUNCHER_FORMATS = [
    { value: "circle", label: "Círculo" },
    { value: "pill", label: "Pílula" },
    { value: "square", label: "Quadrado" },
];
const POSITIONS = [
    { value: "bottom-right", label: "Inferior Direito" },
    { value: "bottom-left", label: "Inferior Esquerdo" },
];
const THEMES = [
    { value: "light", label: "Claro" },
    { value: "dark", label: "Escuro" },
    { value: "auto", label: "Automático" },
];
const TRIGGER_OPTIONS = [
    { value: "time", label: "Tempo na página" },
    { value: "scroll", label: "Scroll" },
    { value: "click", label: "Apenas clique" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h4 style={{
            margin: "0 0 16px 0", fontSize: "0.95rem", fontWeight: 700,
            color: "var(--text-primary)", letterSpacing: "-0.3px"
        }}>
            {children}
        </h4>
    );
}

function FieldGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
    return (
        <div style={{ marginBottom: 18 }}>
            <label style={{
                display: "block", fontSize: "0.82rem", fontWeight: 600,
                color: "var(--text-secondary)", marginBottom: 6
            }}>
                {label}
            </label>
            {children}
            {hint && <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4, opacity: 0.8 }}>{hint}</div>}
        </div>
    );
}

function TextInput({ value, onChange, placeholder, type = "text" }: {
    value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--bg-secondary)",
                color: "var(--text-primary)", fontSize: "0.85rem", outline: "none",
                transition: "border-color 0.2s"
            }}
        />
    );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: {
    value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--bg-secondary)",
                color: "var(--text-primary)", fontSize: "0.85rem", outline: "none",
                resize: "vertical", fontFamily: "inherit", transition: "border-color 0.2s"
            }}
        />
    );
}

function SelectInput({ value, onChange, options }: {
    value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--bg-secondary)",
                color: "var(--text-primary)", fontSize: "0.85rem", outline: "none",
                cursor: "pointer"
            }}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
    return (
        <div
            onClick={() => onChange(!checked)}
            style={{
                display: "flex", alignItems: "center", gap: 10, cursor: "pointer"
            }}
        >
            <div style={{
                width: 42, height: 24, borderRadius: 12,
                background: checked ? "var(--accent)" : "var(--border)",
                padding: 3, transition: "background 0.2s", flexShrink: 0
            }}>
                <div style={{
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    transform: checked ? "translateX(18px)" : "translateX(0)",
                    transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                }} />
            </div>
            {label && (
                <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>
                    {label}
                </span>
            )}
        </div>
    );
}

function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
    return (
        <FieldGroup label={label}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        width: 40, height: 40, borderRadius: 10,
                        border: "2px solid var(--border)", cursor: "pointer",
                        padding: 0, background: "transparent"
                    }}
                />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: 8,
                        border: "1px solid var(--border)", background: "var(--bg-secondary)",
                        color: "var(--text-primary)", fontSize: "0.82rem",
                        fontFamily: "monospace", outline: "none"
                    }}
                />
            </div>
        </FieldGroup>
    );
}

export function WidgetSettings({ onBack }: { onBack: () => void }) {
    const [config, setConfig] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);
    const [snippet, setSnippet] = useState("");
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<TabKey>("aparencia");
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        api.get("/api/widget").then((res) => {
            if (res.data.exists) {
                setConfig(res.data.config || {});
                setPublished(!!res.data.publishedAt);
            }
        }).catch(console.error).finally(() => setLoading(false));

        api.get("/api/widget/snippet").then((res) => {
            setSnippet(res.data.snippet || "");
        }).catch(console.error);
    }, []);

    const updateConfig = useCallback((key: string, value: any) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put("/api/widget", { config });
            showToast("Configuração salva com sucesso!");
        } catch (err: any) {
            showToast("Erro ao salvar: " + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            await api.put("/api/widget", { config });
            await api.post("/api/widget/publish");
            setPublished(true);
            showToast("Widget publicado com sucesso! 🚀");
        } catch (err: any) {
            showToast("Erro ao publicar: " + (err.response?.data?.error || err.message));
        } finally {
            setPublishing(false);
        }
    };

    const handleCopySnippet = () => {
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    // Quick replies management
    const addQuickReply = () => {
        const current = config.quickReplies || [];
        updateConfig("quickReplies", [...current, { label: "", action: "" }]);
    };

    const updateQuickReply = (index: number, field: string, value: string) => {
        const current = [...(config.quickReplies || [])];
        current[index] = { ...current[index], [field]: value };
        updateConfig("quickReplies", current);
    };

    const removeQuickReply = (index: number) => {
        const current = [...(config.quickReplies || [])];
        current.splice(index, 1);
        updateConfig("quickReplies", current);
    };

    if (loading) {
        return (
            <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)"
            }}>
                Carregando configurações do widget...
            </div>
        );
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case "aparencia":
                return (
                    <div>
                        <SectionTitle>Cores</SectionTitle>
                        <ColorPicker label="Cor Primária" value={config.corPrimaria || "#6C63FF"} onChange={(v) => updateConfig("corPrimaria", v)} />
                        <ColorPicker label="Cor de Fundo" value={config.corFundo || "#FFFFFF"} onChange={(v) => updateConfig("corFundo", v)} />
                        <ColorPicker label="Cor do Texto" value={config.corTexto || "#1A1A2E"} onChange={(v) => updateConfig("corTexto", v)} />

                        <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />

                        <SectionTitle>Estilo</SectionTitle>
                        <FieldGroup label="Tema">
                            <SelectInput
                                value={config.tema || "light"}
                                onChange={(v) => updateConfig("tema", v)}
                                options={THEMES}
                            />
                        </FieldGroup>

                        <FieldGroup label="Fonte">
                            <SelectInput
                                value={config.fonte || "Inter"}
                                onChange={(v) => updateConfig("fonte", v)}
                                options={FONTS.map((f) => ({ value: f, label: f }))}
                            />
                        </FieldGroup>

                        <FieldGroup label="Formato do Launcher">
                            <SelectInput
                                value={config.launcherFormato || "circle"}
                                onChange={(v) => updateConfig("launcherFormato", v)}
                                options={LAUNCHER_FORMATS}
                            />
                        </FieldGroup>

                        <FieldGroup label="Posição na Tela">
                            <SelectInput
                                value={config.posicao || "bottom-right"}
                                onChange={(v) => updateConfig("posicao", v)}
                                options={POSITIONS}
                            />
                        </FieldGroup>

                        <FieldGroup label="URL do Avatar/Logo" hint="URL de uma imagem para exibir no cabeçalho do widget.">
                            <TextInput
                                value={config.avatarUrl || ""}
                                onChange={(v) => updateConfig("avatarUrl", v)}
                                placeholder="https://seusite.com/logo.png"
                            />
                        </FieldGroup>

                        <ToggleSwitch
                            checked={config.animacoesAtivas ?? true}
                            onChange={(v) => updateConfig("animacoesAtivas", v)}
                            label="Animações ativas"
                        />
                    </div>
                );

            case "mensagens":
                return (
                    <div>
                        <SectionTitle>Textos do Widget</SectionTitle>
                        <FieldGroup label="Mensagem de Boas-Vindas">
                            <TextArea
                                value={config.mensagemBoasVindas || ""}
                                onChange={(v) => updateConfig("mensagemBoasVindas", v)}
                                placeholder="Olá! Como podemos ajudar?"
                            />
                        </FieldGroup>

                        <FieldGroup label="Mensagem Fora do Horário">
                            <TextArea
                                value={config.mensagemForaHorario || ""}
                                onChange={(v) => updateConfig("mensagemForaHorario", v)}
                                placeholder="Estamos fora do horário de atendimento..."
                            />
                        </FieldGroup>

                        <FieldGroup label="Mensagem de Despedida">
                            <TextArea
                                value={config.mensagemDespedida || ""}
                                onChange={(v) => updateConfig("mensagemDespedida", v)}
                                placeholder="Obrigado pelo contato! Até logo."
                            />
                        </FieldGroup>

                        <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />

                        <SectionTitle>Respostas Rápidas (Quick Replies)</SectionTitle>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {(config.quickReplies || []).map((qr: QuickReply, i: number) => (
                                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input
                                        value={qr.label}
                                        onChange={(e) => updateQuickReply(i, "label", e.target.value)}
                                        placeholder="Texto do botão"
                                        style={{
                                            flex: 1, padding: "8px 10px", borderRadius: 8,
                                            border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                            color: "var(--text-primary)", fontSize: "0.82rem", outline: "none"
                                        }}
                                    />
                                    <button
                                        onClick={() => removeQuickReply(i)}
                                        style={{
                                            background: "none", border: "none", cursor: "pointer",
                                            color: "var(--text-secondary)", padding: 4
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={addQuickReply}
                                style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    background: "rgba(108,99,255,0.08)", border: "1px dashed var(--border)",
                                    borderRadius: 10, padding: "8px 14px", cursor: "pointer",
                                    color: "var(--accent)", fontSize: "0.82rem", fontWeight: 600
                                }}
                            >
                                <Plus size={14} /> Adicionar resposta rápida
                            </button>
                        </div>
                    </div>
                );

            case "abertura":
                return (
                    <div>
                        <SectionTitle>Comportamento de Abertura</SectionTitle>
                        <div style={{ marginBottom: 18 }}>
                            <ToggleSwitch
                                checked={config.autoOpen ?? false}
                                onChange={(v) => updateConfig("autoOpen", v)}
                                label="Abrir automaticamente"
                            />
                        </div>

                        {config.autoOpen && (
                            <>
                                <FieldGroup label="Delay para abrir (segundos)" hint="Tempo em segundos antes do widget abrir sozinho.">
                                    <input
                                        type="number"
                                        min={1}
                                        max={60}
                                        value={config.autoOpenDelaySegundos || 5}
                                        onChange={(e) => updateConfig("autoOpenDelaySegundos", parseInt(e.target.value) || 5)}
                                        style={{
                                            width: 120, padding: "10px 12px", borderRadius: 10,
                                            border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                            color: "var(--text-primary)", fontSize: "0.85rem", outline: "none"
                                        }}
                                    />
                                </FieldGroup>

                                <FieldGroup label="Gatilho de Abertura">
                                    <SelectInput
                                        value={config.gatilhoAbertura || "time"}
                                        onChange={(v) => updateConfig("gatilhoAbertura", v)}
                                        options={TRIGGER_OPTIONS}
                                    />
                                </FieldGroup>
                            </>
                        )}

                        <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />

                        <SectionTitle>Notificações</SectionTitle>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <ToggleSwitch
                                checked={config.somNotificacao ?? true}
                                onChange={(v) => updateConfig("somNotificacao", v)}
                                label="Som de notificação"
                            />
                            <ToggleSwitch
                                checked={config.badgeAtivo ?? true}
                                onChange={(v) => updateConfig("badgeAtivo", v)}
                                label="Badge de mensagens não lidas"
                            />
                        </div>
                    </div>
                );

            case "identidade":
                return (
                    <div>
                        <SectionTitle>Identificação do Visitante</SectionTitle>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
                            Configure quais informações o visitante precisa fornecer antes de iniciar uma conversa.
                            Se nenhum campo estiver ativo, o visitante conversa anonimamente.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <ToggleSwitch
                                checked={config.exigirNome ?? false}
                                onChange={(v) => updateConfig("exigirNome", v)}
                                label="Exigir nome"
                            />
                            <ToggleSwitch
                                checked={config.exigirEmail ?? false}
                                onChange={(v) => updateConfig("exigirEmail", v)}
                                label="Exigir email"
                            />
                            <ToggleSwitch
                                checked={config.exigirTelefone ?? false}
                                onChange={(v) => updateConfig("exigirTelefone", v)}
                                label="Exigir telefone"
                            />
                        </div>
                    </div>
                );

            case "lgpd":
                return (
                    <div>
                        <SectionTitle>Conformidade LGPD</SectionTitle>
                        <FieldGroup label="Texto de Consentimento" hint="Será exibido no início da conversa. Deixe vazio para não exibir.">
                            <TextArea
                                value={config.textoConsentimentoLgpd || ""}
                                onChange={(v) => updateConfig("textoConsentimentoLgpd", v)}
                                placeholder="Ao iniciar esta conversa, você concorda com nossa política de privacidade..."
                                rows={4}
                            />
                        </FieldGroup>

                        <div style={{ marginTop: 16 }}>
                            <ToggleSwitch
                                checked={config.altoContrasteDisponivel ?? false}
                                onChange={(v) => updateConfig("altoContrasteDisponivel", v)}
                                label="Alto contraste disponível para o visitante"
                            />
                        </div>
                    </div>
                );

            case "snippet":
                return (
                    <div>
                        <SectionTitle>Código de Instalação</SectionTitle>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                            Cole o código abaixo antes do <code style={{ background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>&lt;/body&gt;</code> do seu site.
                            O widget aparecerá automaticamente em todas as páginas.
                        </p>

                        {!published && (
                            <div style={{
                                background: "rgba(255, 152, 0, 0.08)", border: "1px solid rgba(255, 152, 0, 0.2)",
                                borderRadius: 12, padding: "12px 16px", marginBottom: 16,
                                display: "flex", alignItems: "center", gap: 10
                            }}>
                                <span style={{ fontSize: 18 }}>⚠️</span>
                                <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>
                                    Você precisa <strong>publicar</strong> o widget antes de usá-lo no seu site.
                                </span>
                            </div>
                        )}

                        <div style={{
                            background: "var(--bg-secondary)", borderRadius: 12,
                            border: "1px solid var(--border)", overflow: "hidden"
                        }}>
                            <div style={{
                                padding: "10px 16px", borderBottom: "1px solid var(--border)",
                                display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>HTML</span>
                                <button
                                    onClick={handleCopySnippet}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 6,
                                        background: copied ? "rgba(76,175,80,0.1)" : "rgba(108,99,255,0.1)",
                                        border: "none", borderRadius: 8, padding: "6px 12px",
                                        cursor: "pointer", color: copied ? "#4CAF50" : "var(--accent)",
                                        fontSize: "0.78rem", fontWeight: 600
                                    }}
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? "Copiado!" : "Copiar"}
                                </button>
                            </div>
                            <pre style={{
                                padding: 16, margin: 0, fontSize: "0.78rem",
                                color: "var(--text-primary)", fontFamily: "'Fira Code', monospace",
                                overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                                lineHeight: 1.6
                            }}>
                                {snippet || "Carregando snippet..."}
                            </pre>
                        </div>

                        <div style={{
                            marginTop: 20, padding: 16, borderRadius: 12,
                            background: "rgba(108,99,255,0.04)", border: "1px solid rgba(108,99,255,0.1)"
                        }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                                💡 Compatibilidade
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                                O widget funciona em qualquer site — WordPress, React, Vue, Angular, HTML estático, etc.
                                Não precisa de npm, build ou framework. Basta colar o snippet e o chat aparece.
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            overflow: "hidden", height: "100%"
        }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 10000,
                    background: "var(--bg-primary)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "12px 20px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                    fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)",
                    animation: "fadeIn 0.3s"
                }}>
                    {toast}
                </div>
            )}

            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Left: Form */}
                <div style={{
                    width: 420, minWidth: 380, display: "flex", flexDirection: "column",
                    borderRight: "1px solid var(--border)", background: "var(--bg-primary)"
                }}>
                    {/* Tab navigation */}
                    <div style={{
                        display: "flex", gap: 0, borderBottom: "1px solid var(--border)",
                        overflowX: "auto", flexShrink: 0
                    }}>
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    style={{
                                        flex: 1, minWidth: 0, padding: "12px 8px",
                                        background: "transparent", border: "none",
                                        borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
                                        color: activeTab === tab.key ? "var(--accent)" : "var(--text-secondary)",
                                        cursor: "pointer", display: "flex", flexDirection: "column",
                                        alignItems: "center", gap: 4, transition: "all 0.2s"
                                    }}
                                >
                                    <Icon size={16} />
                                    <span style={{ fontSize: "0.68rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                                        {tab.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab content */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
                        {renderTabContent()}
                    </div>

                    {/* Action buttons */}
                    <div style={{
                        padding: "16px 24px", borderTop: "1px solid var(--border)",
                        display: "flex", gap: 10, background: "var(--bg-primary)", flexShrink: 0
                    }}>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                padding: "12px 0", borderRadius: 10,
                                border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 700,
                                cursor: saving ? "wait" : "pointer", transition: "all 0.2s"
                            }}
                        >
                            <Save size={16} />
                            {saving ? "Salvando..." : "Salvar Rascunho"}
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={publishing}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                padding: "12px 0", borderRadius: 10,
                                border: "none", background: "var(--accent)",
                                color: "#fff", fontSize: "0.85rem", fontWeight: 700,
                                cursor: publishing ? "wait" : "pointer", transition: "all 0.2s",
                                boxShadow: "0 4px 12px rgba(0,168,132,0.3)"
                            }}
                        >
                            <Rocket size={16} />
                            {publishing ? "Publicando..." : "Publicar"}
                        </button>
                    </div>
                </div>

                {/* Right: Preview */}
                <div style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    background: "var(--bg-secondary)", overflow: "hidden"
                }}>
                    <div style={{
                        padding: "14px 24px", borderBottom: "1px solid var(--border)",
                        display: "flex", alignItems: "center", gap: 10,
                        background: "var(--bg-primary)", flexShrink: 0
                    }}>
                        <Globe size={16} color="var(--accent)" />
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            Preview ao Vivo
                        </span>
                        <span style={{
                            fontSize: "0.72rem", color: "var(--text-secondary)", marginLeft: "auto"
                        }}>
                            As mudanças aparecem em tempo real
                        </span>
                    </div>
                    <div style={{ flex: 1, padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: "100%", maxWidth: 500, height: "100%" }}>
                            <WidgetPreview config={config} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
