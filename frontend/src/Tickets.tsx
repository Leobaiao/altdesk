import React, { useEffect, useState, useCallback } from "react";
import { TicketList } from "./components/TicketList";
import { TicketDetail } from "./components/TicketDetail";
import { Kanban } from "./components/Kanban";
import type { TicketData } from "./components/TicketList";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "./lib/api";
import {
    LayoutList,
    KanbanSquare,
    RefreshCw,
    Ticket,
    AlertTriangle,
    Clock,
    CheckCircle2
} from "lucide-react";

interface Props {
    token: string;
    onBack: () => void;
    role: string;
}

interface TicketStats {
    total: number;
    breached: number;
    warning: number;
    onTime: number;
}

export function Tickets({ token, onBack, role }: Props) {
    const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>(role === 'END_USER' ? 'list' : 'kanban');
    const [refreshKey, setRefreshKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [stats, setStats] = useState<TicketStats>({ total: 0, breached: 0, warning: 0, onTime: 0 });

    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        api.get("/api/profile")
            .then(res => setProfile(res.data))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (location.state?.ticketId) {
            handleKanbanSelect(location.state.ticketId);
            // Clear the state so it doesn't re-trigger if the user navigates back
            window.history.replaceState({}, document.title);
        }
    }, [location.state?.ticketId]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        setRefreshKey(k => k + 1);
        setTimeout(() => setIsRefreshing(false), 800);
    }, []);

    const handleStatsUpdate = useCallback((newStats: TicketStats) => {
        setStats(newStats);
    }, []);

    function handleTicketUpdate() {
        setRefreshKey(k => k + 1); // Trigger background refresh for Kanban/List
        if (selectedTicket) {
            api.get<TicketData[]>("/api/conversations")
                .then(res => {
                    const updated = (res.data || []).find(t => t.ConversationId === selectedTicket.ConversationId);
                    if (updated) setSelectedTicket(updated);
                })
                .catch(console.error);
        }
    }

    async function handleKanbanSelect(ticketOrConversationId: string) {
        try {
            const res = await api.get<TicketData[]>("/api/conversations");
            const fullTicket = res.data?.find(t => t.ConversationId === ticketOrConversationId || t.id === ticketOrConversationId);
            if (fullTicket) {
                setSelectedTicket(fullTicket);
            }
        } catch (e) {
            console.error(e);
        }
    }

    if (selectedTicket) {
        return (
            <div style={{ flex: 1, height: "100%", overflow: "hidden" }}>
                <TicketDetail
                    ticket={selectedTicket}
                    onBack={() => setSelectedTicket(null)}
                    profile={profile}
                    role={role}
                    onTicketUpdate={handleTicketUpdate}
                />
            </div>
        );
    }

    const statItems = [
        { icon: Ticket, label: 'Total', value: stats.total, color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
        { icon: AlertTriangle, label: 'Atrasados', value: stats.breached, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
        { icon: Clock, label: 'Em risco', value: stats.warning, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
        { icon: CheckCircle2, label: 'No prazo', value: stats.onTime, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
    ];

    return (
        <div style={{
            flex: 1, height: "100%", display: "flex", flexDirection: "column",
            overflow: "hidden", background: "var(--bg-primary, #f4f6f8)"
        }}>
            {/* ─── Unified Header ─── */}
            <div style={{
                padding: '14px 24px',
                background: 'var(--bg-secondary, #fff)',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex', alignItems: 'center', gap: 16,
                flexWrap: 'wrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                position: 'relative', zIndex: 10
            }}>
                {/* Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto', minWidth: 0 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', flexShrink: 0
                    }}>
                        <Ticket size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{
                            margin: 0, fontSize: '1.1rem', fontWeight: 700,
                            color: 'var(--text-primary, #111827)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                            Tickets
                        </h1>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #6b7280)' }}>
                            {viewMode === 'kanban' ? 'Visão Kanban' : 'Visão Lista'}
                        </span>
                    </div>
                </div>

                {/* Stats (hide on very small screens via min-width) */}
                <div style={{
                    display: 'flex', gap: 6, alignItems: 'center',
                    flexShrink: 0, flexWrap: 'wrap'
                }}>
                    {statItems.map(s => (
                        <div key={s.label} title={s.label} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '4px 10px', borderRadius: 8,
                            background: s.bg, fontSize: '0.75rem',
                            color: s.color, fontWeight: 600,
                            whiteSpace: 'nowrap',
                            cursor: 'help'
                        }}>
                            <s.icon size={13} />
                            <span>{s.value}</span>
                        </div>
                    ))}
                </div>

                {/* View Toggle + Refresh */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {role !== 'END_USER' && (
                        <div style={{
                            display: 'flex', gap: 2,
                            background: 'var(--bg-primary, #f3f4f6)',
                            borderRadius: 10, padding: 3,
                            border: '1px solid var(--border, #e5e7eb)'
                        }}>
                            <button
                                onClick={() => setViewMode('kanban')}
                                style={{
                                    padding: '6px 10px', borderRadius: 8,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: 5, cursor: 'pointer', border: 'none',
                                    fontSize: '0.78rem', fontWeight: 600,
                                    transition: 'all 0.2s ease',
                                    background: viewMode === 'kanban' ? 'var(--bg-secondary, #fff)' : 'transparent',
                                    color: viewMode === 'kanban' ? '#6366f1' : 'var(--text-secondary, #9ca3af)',
                                    boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                                }}
                                title="Modo Kanban"
                            >
                                <KanbanSquare size={16} />
                                <span className="hide-mobile">Kanban</span>
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                style={{
                                    padding: '6px 10px', borderRadius: 8,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: 5, cursor: 'pointer', border: 'none',
                                    fontSize: '0.78rem', fontWeight: 600,
                                    transition: 'all 0.2s ease',
                                    background: viewMode === 'list' ? 'var(--bg-secondary, #fff)' : 'transparent',
                                    color: viewMode === 'list' ? '#6366f1' : 'var(--text-secondary, #9ca3af)',
                                    boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                                }}
                                title="Modo Lista"
                            >
                                <LayoutList size={16} />
                                <span className="hide-mobile">Lista</span>
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        style={{
                            width: 36, height: 36, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: isRefreshing ? 'default' : 'pointer',
                            border: '1px solid var(--border, #e5e7eb)',
                            background: 'var(--bg-primary, #f3f4f6)',
                            color: 'var(--text-secondary, #6b7280)',
                            transition: 'all 0.2s ease',
                            opacity: isRefreshing ? 0.6 : 1
                        }}
                        title="Atualizar"
                    >
                        <RefreshCw
                            size={16}
                            style={{
                                transition: 'transform 0.3s ease',
                                animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none'
                            }}
                        />
                    </button>
                </div>
            </div>

            {/* ─── Content Area ─── */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {viewMode === 'kanban' ? (
                    <Kanban
                        onSelectTicket={handleKanbanSelect}
                        refreshKey={refreshKey}
                        onStatsUpdate={handleStatsUpdate}
                    />
                ) : (
                    <TicketList
                        onSelect={setSelectedTicket}
                        selectedId={null}
                        onBack={onBack}
                        refreshKey={refreshKey}
                        onStatsUpdate={handleStatsUpdate}
                    />
                )}
            </div>
        </div>
    );
}
