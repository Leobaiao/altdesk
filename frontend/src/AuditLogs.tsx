import React, { useState, useEffect } from "react";
import { api } from "./lib/api";
import { PageHeader } from "./components/PageHeader";
import { ListFilter, User, Clock, FileText, Database, ChevronRight, Eye } from "lucide-react";

interface AuditLog {
    AuditId: string;
    Action: string;
    TargetTable: string;
    TargetId: string;
    BeforeValues: string;
    AfterValues: string;
    UserName: string;
    UserEmail: string;
    IpAddress: string;
    UserAgent: string;
    CreatedAt: string;
}

interface Props {
    onBack: () => void;
}

export function AuditLogs({ onBack }: Props) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        api.get("/api/audit")
            .then(res => {
                setLogs(res.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Erro ao carregar logs:", err);
                setLoading(false);
            });
    }, []);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pt-BR');
    };

    const renderJson = (json: string) => {
        try {
            if (!json) return <span style={{ opacity: 0.5 }}>-</span>;
            const obj = JSON.parse(json);
            return (
                <pre style={{ 
                    fontSize: "0.8rem", 
                    background: "rgba(0,0,0,0.1)", 
                    padding: 10, 
                    borderRadius: 8, 
                    overflowX: "auto",
                    color: "var(--text-primary)"
                }}>
                    {JSON.stringify(obj, null, 2)}
                </pre>
            );
        } catch (e) {
            return <span>{json}</span>;
        }
    };

    return (
        <div style={{ height: "100%", padding: "24px", overflowY: "auto" }}>
            <PageHeader
                title="Logs de Auditoria"
                subtitle="Histórico completo de ações administrativas e alterações de dados."
                icon={ListFilter}
                onBack={onBack}
            />

            <div style={{ display: "grid", gridTemplateColumns: selectedLog ? "1fr 400px" : "1fr", gap: 24, transition: "all 0.3s" }}>
                <div style={{ background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>Ações Recentes</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Exibindo os últimos 100 registros</span>
                    </div>

                    {loading ? (
                        <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>Carregando logs...</div>
                    ) : logs.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>Nenhum log encontrado.</div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                                <thead>
                                    <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.02)" }}>
                                        <th style={{ padding: 15, borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 500 }}>Data</th>
                                        <th style={{ padding: 15, borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 500 }}>Usuário</th>
                                        <th style={{ padding: 15, borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 500 }}>Ação</th>
                                        <th style={{ padding: 15, borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 500 }}>Entidade</th>
                                        <th style={{ padding: 15, borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 500 }}>IP</th>
                                        <th style={{ padding: 15, borderBottom: "1px solid var(--border)", width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr 
                                            key={log.AuditId} 
                                            onClick={() => setSelectedLog(log)}
                                            style={{ 
                                                borderBottom: "1px solid var(--border)", 
                                                cursor: "pointer", 
                                                background: selectedLog?.AuditId === log.AuditId ? "rgba(var(--accent-rgb), 0.05)" : "transparent",
                                                transition: "background 0.2s"
                                            }}
                                            onMouseEnter={e => !selectedLog && (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                                            onMouseLeave={e => selectedLog?.AuditId !== log.AuditId && (e.currentTarget.style.background = "transparent")}
                                        >
                                            <td style={{ padding: 15, whiteSpace: "nowrap" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <Clock size={14} style={{ opacity: 0.5 }} />
                                                    {formatDate(log.CreatedAt)}
                                                </div>
                                            </td>
                                            <td style={{ padding: 15 }}>
                                                <div style={{ display: "flex", flexDirection: "column" }}>
                                                    <span style={{ fontWeight: 500 }}>{log.UserName || "Sistema"}</span>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{log.UserEmail}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: 15 }}>
                                                <span style={{ 
                                                    padding: "4px 8px", 
                                                    borderRadius: 6, 
                                                    fontSize: "0.75rem", 
                                                    fontWeight: 600,
                                                    background: log.Action.includes("DELETE") ? "rgba(234, 67, 53, 0.1)" : 
                                                                log.Action.includes("CREATE") ? "rgba(0, 168, 132, 0.1)" : "rgba(255,255,255,0.05)",
                                                    color: log.Action.includes("DELETE") ? "#ea4335" : 
                                                           log.Action.includes("CREATE") ? "#00a884" : "var(--text-primary)"
                                                }}>
                                                    {log.Action}
                                                </span>
                                            </td>
                                            <td style={{ padding: 15, color: "var(--text-secondary)" }}>
                                                {log.TargetTable}
                                            </td>
                                            <td style={{ padding: 15, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                                {log.IpAddress || "-"}
                                            </td>
                                            <td style={{ padding: 15, textAlign: "right" }}>
                                                <ChevronRight size={18} style={{ opacity: 0.3 }} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {selectedLog && (
                    <div style={{ 
                        background: "var(--bg-secondary)", 
                        borderRadius: 16, 
                        border: "1px solid var(--border)", 
                        display: "flex", 
                        flexDirection: "column",
                        position: "sticky",
                        top: 0,
                        maxHeight: "calc(100vh - 48px)"
                    }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 600 }}>Detalhes da Ação</span>
                            <button onClick={() => setSelectedLog(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>&times;</button>
                        </div>
                        
                        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
                            <div>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 8 }}>
                                    <Database size={14} /> ID do Objeto
                                </label>
                                <div style={{ fontSize: "0.85rem", wordBreak: "break-all", fontFamily: "monospace", opacity: 0.8 }}>{selectedLog.TargetId}</div>
                            </div>

                            <div style={{ height: 1, background: "var(--border)" }} />

                            <div>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 8 }}>
                                    <FileText size={14} /> Dados Anteriores
                                </label>
                                {renderJson(selectedLog.BeforeValues)}
                            </div>

                            <div>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 8 }}>
                                    <FileText size={14} /> Novos Dados
                                </label>
                                {renderJson(selectedLog.AfterValues)}
                            </div>

                            <div style={{ marginTop: "auto", padding: 15, background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>
                                <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>Dispositivo / User Agent</div>
                                <div style={{ fontSize: "0.7rem", marginTop: 4, lineHeight: 1.4, color: "var(--text-secondary)" }}>{selectedLog.UserAgent || "Não capturado"}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
