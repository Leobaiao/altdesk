import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
    CREATE: { bg: "rgba(0,168,132,0.12)", color: "#00a884" },
    UPDATE: { bg: "rgba(66,133,244,0.12)", color: "#4285f4" },
    DELETE: { bg: "rgba(234,67,53,0.12)", color: "#ea4335" },
    STATUS: { bg: "rgba(255,152,0,0.12)", color: "#ff9800" },
    LOGIN: { bg: "rgba(156,39,176,0.12)", color: "#9c27b0" },
};

function getActionStyle(action: string) {
    const key = Object.keys(ACTION_COLORS).find(k => action.toUpperCase().includes(k));
    return key ? ACTION_COLORS[key] : { bg: "rgba(255,255,255,0.06)", color: "#aaa" };
}

export function AuditTab() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [tenantFilter, setTenantFilter] = useState("");
    const [tenants, setTenants] = useState<any[]>([]);
    const [page, setPage] = useState(1);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page, limit: 50 };
            if (tenantFilter) params.tenantId = tenantFilter;
            if (search) params.action = search;
            const r = await api.get("/api/admin/audit-logs", { params });
            setLogs(Array.isArray(r.data) ? r.data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page, tenantFilter, search]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    useEffect(() => {
        api.get("/api/admin/tenants").then(r => setTenants(Array.isArray(r.data) ? r.data : [])).catch(() => { });
    }, []);

    return (
        <>
            {/* Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
                    {/* Action search */}
                    <div style={{ position: "relative", maxWidth: 260, flex: 1 }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }}>🔍</span>
                        <input
                            placeholder="Filtrar por ação (ex: CREATE, LOGIN)..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.85rem", outline: "none" }}
                            onFocus={e => (e.target.style.boxShadow = "0 0 0 2px var(--accent)")}
                            onBlur={e => (e.target.style.boxShadow = "none")}
                        />
                    </div>
                    {/* Tenant filter */}
                    <select
                        value={tenantFilter}
                        onChange={e => { setTenantFilter(e.target.value); setPage(1); }}
                        style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.85rem", outline: "none" }}
                    >
                        <option value="">Todas as Empresas</option>
                        {tenants.map(t => <option key={t.TenantId} value={t.TenantId}>{t.Name}</option>)}
                    </select>
                    {!loading && <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", whiteSpace: "nowrap" }}><b style={{ color: "var(--text-primary)" }}>{logs.length}</b> eventos</span>}
                </div>
                <button onClick={loadLogs} className="btn btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 10, border: "1px solid var(--border)", padding: "9px 16px" }}>
                    <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                    Atualizar
                </button>
            </div>

            {/* Table */}
            <div className="admin-table-container" style={{ overflowX: "auto", background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-primary)" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-active)", textAlign: "left" }}>
                            {["Data/Hora", "Ação", "Tabela Alvo", "ID Alvo", "Usuário", "Empresa", "IP"].map(h => (
                                <th key={h} style={{ padding: "14px 20px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-secondary)", fontWeight: 700 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>⏳ Carregando logs...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                                    <ShieldCheck size={40} opacity={0.2} />
                                    <span>Nenhum log de auditoria encontrado</span>
                                </div>
                            </td></tr>
                        ) : logs.map(log => {
                            const s = getActionStyle(log.Action);
                            return (
                                <tr key={log.LogId} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }} className="table-row-hover">
                                    <td style={{ padding: "13px 20px", fontSize: "0.82rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                                        {new Date(log.CreatedAt).toLocaleString("pt-BR")}
                                    </td>
                                    <td style={{ padding: "13px 20px" }}>
                                        <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 8, fontSize: "0.73rem", fontWeight: 700, letterSpacing: "0.4px" }}>
                                            {log.Action}
                                        </span>
                                    </td>
                                    <td style={{ padding: "13px 20px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{log.TargetTable || "—"}</td>
                                    <td style={{ padding: "13px 20px" }}>
                                        {log.TargetId ? (
                                            <code style={{ fontSize: "0.72rem", color: "var(--text-secondary)", background: "var(--bg-primary)", padding: "2px 7px", borderRadius: 5, border: "1px solid var(--border)" }}>
                                                {log.TargetId.length > 12 ? log.TargetId.slice(0, 12) + "…" : log.TargetId}
                                            </code>
                                        ) : "—"}
                                    </td>
                                    <td style={{ padding: "13px 20px" }}>
                                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{log.UserName || "Sistema"}</div>
                                        {log.UserEmail && <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{log.UserEmail}</div>}
                                    </td>
                                    <td style={{ padding: "13px 20px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{log.TenantName || "—"}</td>
                                    <td style={{ padding: "13px 20px", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                        <code style={{ background: "var(--bg-primary)", padding: "2px 6px", borderRadius: 5, border: "1px solid var(--border)" }}>{log.IpAddress || "—"}</code>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {logs.length === 50 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 20 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-ghost" style={{ borderRadius: 10, border: "1px solid var(--border)", padding: "8px 20px", opacity: page === 1 ? 0.4 : 1 }}>← Anterior</button>
                    <span style={{ display: "flex", alignItems: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Página {page}</span>
                    <button onClick={() => setPage(p => p + 1)} className="btn btn-ghost" style={{ borderRadius: 10, border: "1px solid var(--border)", padding: "8px 20px" }}>Próxima →</button>
                </div>
            )}
        </>
    );
}
