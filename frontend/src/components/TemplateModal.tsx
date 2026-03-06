import React, { useEffect, useState } from "react";

type Template = {
    TemplateId: string;
    Name: string;
    Content: string;
    Variables: string[];
};

type TemplateModalProps = {
    onClose: () => void;
    onSend: (text: string) => void;
};

import { api } from "../lib/api";

export function TemplateModal({ onClose, onSend }: TemplateModalProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [view, setView] = useState<"SELECT" | "MANAGE">("SELECT");
    const [loading, setLoading] = useState(false);

    // Manage State
    const [newName, setNewName] = useState("");
    const [newContent, setNewContent] = useState("");
    // const [newVars, setNewVars] = useState("");

    // Select State
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [varValues, setVarValues] = useState<string[]>([]);

    useEffect(() => {
        fetchTemplates();
    }, []);

    async function fetchTemplates() {
        setLoading(true);
        try {
            const res = await api.get<Template[]>("/api/templates");
            if (Array.isArray(res.data)) {
                setTemplates(res.data);
            } else {
                console.error("API returned non-array for templates:", res.data);
                setTemplates([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!newName || !newContent) return;
        try {
            // Parse variables from {{var}}
            const vars = newContent.match(/{{[^{}]+}}/g) || [];
            const cleanVars = vars.map(v => v.replace(/{{|}}/g, ""));

            await api.post("/api/templates", { name: newName, content: newContent, variables: cleanVars });
            setNewName("");
            setNewContent("");
            fetchTemplates();
            // alert("Template criado!"); // Use toast ideally, but simple for now
        } catch (err) {
            console.error("Erro ao criar");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Tem certeza?")) return;
        await api.delete(`/api/templates/${id}`);
        fetchTemplates();
    }

    function handleSelect(t: Template) {
        setSelectedTemplate(t);
        setVarValues(new Array(t.Variables.length).fill(""));
    }

    function handleSendTemplate() {
        if (!selectedTemplate) return;
        // Replace variables in content
        let finalText = selectedTemplate.Content;
        selectedTemplate.Variables.forEach((v, i) => {
            const placeholder = `{{${v}}}`;
            finalText = finalText.replace(placeholder, varValues[i] || "");
        });

        // Fallback simple replace for generic {{1}}, {{2}} if we want stricter matching
        // But above covers it if variables are extracted correctly.

        onSend(finalText);
        onClose();
    }

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.7)", zIndex: 2000,
            display: "flex", alignItems: "center", justifyContent: "center"
        }}>
            <div style={{
                width: "500px", background: "var(--bg-secondary)", borderRadius: "8px",
                padding: "20px", display: "flex", flexDirection: "column", gap: "15px",
                height: "80vh", maxHeight: "600px"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ color: "var(--text-primary)", margin: 0 }}>Modelos de Mensagem (HSM)</h2>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "#8696a0", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
                </div>

                <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                    <button onClick={() => setView("SELECT")} style={{ flex: 1, padding: "8px", background: view === "SELECT" ? "#00a884" : "transparent", borderBottom: view === "SELECT" ? "2px solid #00a884" : "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer", border: "none", borderRadius: "4px" }}>Selecionar</button>
                    <button onClick={() => setView("MANAGE")} style={{ flex: 1, padding: "8px", background: view === "MANAGE" ? "#00a884" : "transparent", borderBottom: view === "MANAGE" ? "2px solid #00a884" : "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer", border: "none", borderRadius: "4px" }}>Gerenciar</button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {view === "SELECT" && (
                        <>
                            {!selectedTemplate ? (
                                <>
                                    {loading ? <p style={{ color: "#888" }}>Carregando...</p> : null}
                                    {templates.length === 0 && !loading && <p style={{ color: "#888" }}>Nenhum template encontrado.</p>}
                                    {templates.map(t => (
                                        <div key={t.TemplateId} onClick={() => handleSelect(t)} style={{ padding: "10px", background: "var(--bg-primary)", borderRadius: "6px", cursor: "pointer", border: "1px solid var(--border)" }}>
                                            <div style={{ fontWeight: "bold", color: "var(--text-primary)" }}>{t.Name}</div>
                                            <div style={{ fontSize: "0.9em", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.Content}</div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    <button onClick={() => setSelectedTemplate(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#00a884", cursor: "pointer" }}>← Voltar</button>
                                    <div style={{ padding: "10px", background: "var(--bg-primary)", borderRadius: "6px" }}>
                                        <div style={{ fontWeight: "bold", color: "var(--text-primary)", marginBottom: "5px" }}>{selectedTemplate.Name}</div>
                                        <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{selectedTemplate.Content}</div>
                                    </div>

                                    {selectedTemplate.Variables.length > 0 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                            <label style={{ color: "var(--text-secondary)" }}>Preencha as variáveis:</label>
                                            {selectedTemplate.Variables.map((v, i) => (
                                                <div key={i}>
                                                    <span style={{ color: "#00a884", fontSize: "0.9em" }}>{`{{${v}}}`}</span>
                                                    <input
                                                        value={varValues[i] || ""}
                                                        onChange={(e) => {
                                                            const newVals = [...varValues];
                                                            newVals[i] = e.target.value;
                                                            setVarValues(newVals);
                                                        }}
                                                        placeholder={`Valor para ${v}`}
                                                        style={{ width: "100%", padding: "8px", marginTop: "5px", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: "4px" }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button onClick={handleSendTemplate} style={{ marginTop: "10px", padding: "10px", background: "#00a884", border: "none", color: "white", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                        Enviar Mensagem
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {view === "MANAGE" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                            <div style={{ padding: "10px", background: "var(--bg-primary)", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Novo Template</h3>
                                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do Template" style={{ padding: "8px", background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: "4px" }} />
                                <textarea
                                    value={newContent}
                                    onChange={e => setNewContent(e.target.value)}
                                    placeholder="Conteúdo (use {{1}}, {{nome}} para variáveis)"
                                    rows={4}
                                    style={{ padding: "8px", background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: "4px", resize: "vertical" }}
                                />
                                <button onClick={handleCreate} style={{ padding: "8px", background: "#00a884", border: "none", color: "#fff", borderRadius: "4px", cursor: "pointer" }}>Criar</button>
                            </div>

                            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                                <h3 style={{ margin: "0 0 10px 0", color: "var(--text-primary)" }}>Existentes</h3>
                                {templates.map(t => (
                                    <div key={t.TemplateId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderBottom: "1px solid var(--border)" }}>
                                        <div style={{ overflow: "hidden" }}>
                                            <div style={{ fontWeight: "bold", color: "var(--text-primary)" }}>{t.Name}</div>
                                            <div style={{ fontSize: "0.8em", color: "var(--text-secondary)" }}>{t.Variables.length} variáveis</div>
                                        </div>
                                        <button onClick={() => handleDelete(t.TemplateId)} style={{ padding: "5px 10px", background: "#ea4335", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>🗑️</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
