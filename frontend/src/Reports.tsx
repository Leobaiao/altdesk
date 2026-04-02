import React, { useState } from "react";
import { api } from "./lib/api";
import { Download, BarChart2, Users, ShieldAlert, RefreshCw } from "lucide-react";
import { PageHeader } from "./components/PageHeader";

type ReportType = "conversations" | "agents" | "sla";

function DateFilter({ from, to, onFrom, onTo }: { from: string, to: string, onFrom: (v: string) => void, onTo: (v: string) => void }) {
    const inputStyle: React.CSSProperties = {
        padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)",
        background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.85rem", outline: "none"
    };
    return (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>De:</label>
            <input type="date" value={from} onChange={e => onFrom(e.target.value)} style={inputStyle} />
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Até:</label>
            <input type="date" value={to} onChange={e => onTo(e.target.value)} style={inputStyle} />
        </div>
    );
}

function SlaCard({ data }: { data: any }) {
    const percent = data?.CompliancePercent ?? 0;
    const color = percent >= 90 ? "#00a884" : percent >= 70 ? "#ff9800" : "#ea4335";
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20, marginTop: 24 }}>
            {[
                { label: "Total de Conversas", value: data?.Total ?? "—", color: "var(--text-primary)" },
                { label: "SLA OK", value: data?.SlaOk ?? "—", color: "#00a884" },
                { label: "SLA Violado", value: data?.SlaViolated ?? "—", color: "#ea4335" },
                { label: "Aguardando", value: data?.SlaPending ?? "—", color: "#ff9800" },
                { label: "Conformidade", value: `${percent}%`, color },
            ].map(c => (
                <div key={c.label} style={{
                    background: "var(--bg-primary)", padding: "20px 24px", borderRadius: 16,
                    border: "1px solid var(--border)", textAlign: "center"
                }}>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--text-secondary)", marginTop: 4, fontWeight: 700 }}>{c.label}</div>
                </div>
            ))}
        </div>
    );
}

export function Reports({ onBack }: { onBack: () => void }) {
    const [report, setReport] = useState<ReportType>("conversations");
    const [from, setFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 30);
        return d.toISOString().split("T")[0];
    });
    const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
    const [data, setData] = useState<any[]>([]);
    const [slaData, setSlaData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const REPORTS = [
        { id: "conversations" as ReportType, label: "Conversas", icon: <BarChart2 size={18} /> },
        { id: "agents" as ReportType, label: "Agentes", icon: <Users size={18} /> },
        { id: "sla" as ReportType, label: "SLA", icon: <ShieldAlert size={18} /> },
    ];

    const loadReport = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (from) params.from = from;
            if (to) params.to = to + "T23:59:59";
            const r = await api.get(`/api/reports/${report}`, { params });
            if (report === "sla") {
                setSlaData(r.data);
                setData([]);
            } else {
                setData(Array.isArray(r.data) ? r.data : []);
                setSlaData(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = async () => {
        const params: any = { format: "csv" };
        if (from) params.from = from;
        if (to) params.to = to + "T23:59:59";
        const r = await api.get(`/api/reports/${report}`, { params, responseType: "blob" });
        const url = window.URL.createObjectURL(new Blob([r.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${report}_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const columns = data.length ? Object.keys(data[0]) : [];

    return (
        <div className="settings-page" style={{ height: "100%", overflowY: "auto" }}>
            <PageHeader
                title="Relatórios"
                subtitle="Exporte dados e analise a performance do atendimento"
                icon={BarChart2}
                onBack={onBack}
                helpText={
                    <div>
                        <p>Transforme dados em decisões estratégicas através de relatórios detalhados de performance.</p>
                        <ul style={{ marginTop: 12, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                            <li><strong>Métricas de Equipe:</strong> Avalie a produtividade individual de cada atendente.</li>
                            <li><strong>Volume de Mensagens:</strong> Acompanhe os picos de demanda diários e mensais.</li>
                            <li><strong>Satisfação:</strong> Monitore o feedback dos clientes (em breve).</li>
                            <li><strong>Exportação:</strong> Gere arquivos CSV/PDF para apresentações externas.</li>
                        </ul>
                    </div>
                }
            />

            {/* Report selector */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: "var(--bg-secondary)", padding: 4, borderRadius: 12, border: "1px solid var(--border)", width: "fit-content", maxWidth: "100%", marginBottom: 28 }}>
                {REPORTS.map(r => (
                    <button key={r.id} onClick={() => setReport(r.id)}
                        style={{ padding: "9px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 8, background: report === r.id ? "var(--accent)" : "transparent", color: report === r.id ? "#fff" : "var(--text-secondary)", transition: "all 0.2s" }}>
                        {r.icon}{r.label}
                    </button>
                ))}
            </div>

            {/* Filters + Actions */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <DateFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={loadReport} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, padding: "9px 20px" }}>
                        <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                        {loading ? "Carregando..." : "Gerar Relatório"}
                    </button>
                    {(data.length > 0 || slaData) && (
                        <button onClick={downloadCSV} className="btn btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, border: "1px solid var(--border)", padding: "9px 20px" }}>
                            <Download size={15} /> Exportar CSV
                        </button>
                    )}
                </div>
            </div>

            {/* SLA Summary */}
            {report === "sla" && slaData && <SlaCard data={slaData} />}

            {/* Table */}
            {data.length > 0 && (
                <div style={{ overflowX: "auto", background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-primary)", fontSize: "0.85rem" }}>
                        <thead>
                            <tr style={{ background: "var(--bg-active)" }}>
                                {columns.map(col => (
                                    <th key={col} style={{ padding: "14px 20px", textAlign: "left", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-secondary)", fontWeight: 700, whiteSpace: "nowrap" }}>
                                        {col.replace(/([A-Z])/g, ' $1').trim()}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }} className="table-row-hover">
                                    {columns.map(col => (
                                        <td key={col} style={{ padding: "12px 20px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                                            {(() => {
                                                const val = row[col];
                                                if (val === null || val === undefined) return "—";
                                                if (col.toLowerCase().includes("at") && String(val).includes("T")) {
                                                    return new Date(val).toLocaleString("pt-BR");
                                                }
                                                return String(val);
                                            })()}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ padding: "12px 20px", fontSize: "0.8rem", color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}>
                        {data.length} registro(s) — gerado em {new Date().toLocaleString("pt-BR")}
                    </div>
                </div>
            )}

            {!loading && !slaData && data.length === 0 && (
                <div style={{ textAlign: "center", padding: 64, color: "var(--text-secondary)", background: "var(--bg-secondary)", borderRadius: 16, border: "1px dashed var(--border)" }}>
                    <BarChart2 size={48} opacity={0.15} style={{ marginBottom: 12 }} />
                    <p>Selecione um período e clique em <b>Gerar Relatório</b></p>
                </div>
            )}
        </div>
    );
}
