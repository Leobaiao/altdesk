import React, { useEffect, useState, useCallback, useMemo } from "react";
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
    CheckCircle2,
    HelpCircle,
    Plus,
    Trash2,
    Edit3,
    Filter,
    Bookmark,
    ChevronRight,
    X
} from "lucide-react";
import { useHelp } from "./contexts/HelpContext";
import { parseJwt } from "./lib/auth";

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

export interface TicketFilters {
    status: string;
    channel: string;
    sla: string;
    assignee: string;
    priority: string;
    search: string;
}

interface CustomList {
    id: string;
    name: string;
    filters: {
        status: string;
        channel: string;
        sla: string;
        assignee: string;
        priority: string;
    };
}

const systemLists = [
    {
        id: "all",
        name: "Todos Atendimentos",
        filters: { status: "ALL", channel: "ALL", sla: "ALL", assignee: "ALL", priority: "ALL" }
    },
    {
        id: "mine",
        name: "Meus Atendimentos",
        filters: { status: "OPEN", channel: "ALL", sla: "ALL", assignee: "ME", priority: "ALL" }
    },
    {
        id: "unassigned",
        name: "Não Atribuídos",
        filters: { status: "OPEN", channel: "ALL", sla: "ALL", assignee: "UNASSIGNED", priority: "ALL" }
    },
    {
        id: "breached",
        name: "SLA Estourado",
        filters: { status: "ALL", channel: "ALL", sla: "VIOLATED", assignee: "ALL", priority: "ALL" }
    }
];

export function Tickets({ token, onBack, role }: Props) {
    const { openHelp, setPageContextKey } = useHelp();
    const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>(role === 'END_USER' ? 'list' : 'kanban');
    const [refreshKey, setRefreshKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [stats, setStats] = useState<TicketStats>({ total: 0, breached: 0, warning: 0, onTime: 0 });

    // Filter states
    const [filters, setFilters] = useState<TicketFilters>({
        status: "ALL",
        channel: "ALL",
        sla: "ALL",
        assignee: "ALL",
        priority: "ALL",
        search: ""
    });
    const [selectedListId, setSelectedListId] = useState<string>("all");

    // Custom lists management
    const decoded = useMemo(() => parseJwt(token), [token]);
    const tenantId = decoded?.tenantId || "default";
    const userId = decoded?.userId || "default";
    const storageKey = `altdesk_custom_lists_${tenantId}_${userId}`;
    
    const [customLists, setCustomLists] = useState<CustomList[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingList, setEditingList] = useState<CustomList | null>(null);

    // Modal fields
    const [listName, setListName] = useState("");
    const [listStatus, setListStatus] = useState("ALL");
    const [listChannel, setListChannel] = useState("ALL");
    const [listSla, setListSla] = useState("ALL");
    const [listAssignee, setListAssignee] = useState("ALL");
    const [listPriority, setListPriority] = useState("ALL");

    const location = useLocation();
    const navigate = useNavigate();

    // Load custom lists
    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                setCustomLists(JSON.parse(saved));
            } catch (e) {
                console.error(e);
            }
        }
    }, [storageKey]);

    useEffect(() => {
        const targetKey = selectedTicket ? "tickets.index" : (viewMode === 'kanban' ? "kanban.index" : "tickets.index");

        setPageContextKey(targetKey);
    }, [viewMode, selectedTicket, setPageContextKey]);

    useEffect(() => {
        api.get("/api/profile")
            .then(res => setProfile(res.data))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (location.state?.ticketId) {
            handleKanbanSelect(location.state.ticketId);
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
        setRefreshKey(k => k + 1);
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

    const handleSelectList = (listId: string, listFilters: any) => {
        setSelectedListId(listId);
        setFilters(prev => ({
            ...prev,
            ...listFilters
        }));
    };

    const handleFilterChange = (newFilters: TicketFilters) => {
        setFilters(newFilters);
        
        // Find if matches system lists
        const matchedSystem = systemLists.find(l => 
            l.filters.status === newFilters.status &&
            l.filters.channel === newFilters.channel &&
            l.filters.sla === newFilters.sla &&
            l.filters.assignee === newFilters.assignee &&
            l.filters.priority === newFilters.priority
        );
        if (matchedSystem) {
            setSelectedListId(matchedSystem.id);
            return;
        }
        
        // Find if matches custom lists
        const matchedCustom = customLists.find(l => 
            l.filters.status === newFilters.status &&
            l.filters.channel === newFilters.channel &&
            l.filters.sla === newFilters.sla &&
            l.filters.assignee === newFilters.assignee &&
            l.filters.priority === newFilters.priority
        );
        if (matchedCustom) {
            setSelectedListId(matchedCustom.id);
            return;
        }
        
        setSelectedListId("custom");
    };

    const handleOpenCreateModal = () => {
        setEditingList(null);
        setListName("");
        setListStatus("ALL");
        setListChannel("ALL");
        setListSla("ALL");
        setListAssignee("ALL");
        setListPriority("ALL");
        setModalOpen(true);
    };

    const handleOpenEditModal = (list: CustomList, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingList(list);
        setListName(list.name);
        setListStatus(list.filters.status);
        setListChannel(list.filters.channel);
        setListSla(list.filters.sla);
        setListAssignee(list.filters.assignee);
        setListPriority(list.filters.priority);
        setModalOpen(true);
    };

    const handleDeleteList = (id: string, name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Excluir a lista personalizada "${name}"?`)) return;
        const updated = customLists.filter(l => l.id !== id);
        setCustomLists(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        if (selectedListId === id) {
            handleSelectList("all", systemLists[0].filters);
        }
    };

    const handleSaveCustomList = (e: React.FormEvent) => {
        e.preventDefault();
        if (!listName.trim()) return;
        
        let updated: CustomList[];
        let activeId: string;
        
        const newFilters = {
            status: listStatus,
            channel: listChannel,
            sla: listSla,
            assignee: listAssignee,
            priority: listPriority
        };

        if (editingList) {
            updated = customLists.map(l => l.id === editingList.id ? {
                ...l,
                name: listName,
                filters: newFilters
            } : l);
            activeId = editingList.id;
        } else {
            const newList: CustomList = {
                id: Math.random().toString(36).substring(2, 9),
                name: listName,
                filters: newFilters
            };
            updated = [...customLists, newList];
            activeId = newList.id;
        }
        
        setCustomLists(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setModalOpen(false);
        handleSelectList(activeId, newFilters);
    };

    if (selectedTicket) {
        return (
            <div style={{ flex: 1, height: "100%", overflow: "hidden" }}>
                <TicketDetail
                    ticket={selectedTicket}
                    onBack={() => setSelectedTicket(null)}
                    profile={profile}
                    role={role}
                    onTicketUpdate={handleTicketUpdate}
                    onSelectTicket={setSelectedTicket}
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
            <style>{`
                @media (max-width: 768px) {
                    .tickets-sidebar { display: none !important; }
                    .tickets-mobile-selector { display: block !important; }
                }
                @media (min-width: 769px) {
                    .tickets-sidebar { display: flex !important; }
                    .tickets-mobile-selector { display: none !important; }
                }
                .list-btn-hover:hover {
                    background: var(--bg-primary, #f3f4f6) !important;
                }
                .list-btn-hover:hover .list-actions {
                    opacity: 1 !important;
                }
            `}</style>

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
                            Atendimentos
                        </h1>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #6b7280)' }}>
                            {viewMode === 'kanban' ? 'Visão Kanban' : 'Visão Lista'}
                        </span>
                    </div>
                </div>

                {/* Stats */}
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

                {/* View Toggle + Refresh + Help */}
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

            {/* ─── Content Area with Saved Lists Sidebar ─── */}
            <div style={{ flex: 1, display: "flex", overflow: 'hidden' }}>
                {/* ─── Sidebar for List Management (Desktop only, hidden on mobile) ─── */}
                <div 
                    className="tickets-sidebar"
                    style={{
                        width: 260,
                        background: 'var(--bg-secondary, #fff)',
                        borderRight: '1px solid var(--border, #e5e7eb)',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0,
                        overflowY: 'auto',
                        padding: '20px 10px'
                    }}
                >
                    {/* System Lists Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '0 12px 10px 12px',
                        fontSize: '0.68rem', fontWeight: 800,
                        color: 'var(--text-secondary, #8696a0)',
                        textTransform: 'uppercase', letterSpacing: '0.8px'
                    }}>
                        <Filter size={11} />
                        <span>Filtros do Sistema</span>
                    </div>

                    {/* System Lists Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 25 }}>
                        {systemLists.map(list => {
                            const active = selectedListId === list.id;
                            return (
                                <button
                                    key={list.id}
                                    onClick={() => handleSelectList(list.id, list.filters)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyItems: 'center',
                                        gap: 10, padding: '10px 14px', borderRadius: 10,
                                        border: 'none', background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                                        color: active ? '#6366f1' : 'var(--text-primary, #4b5563)',
                                        fontSize: '0.85rem', fontWeight: active ? 700 : 500,
                                        cursor: 'pointer', textAlign: 'left',
                                        transition: 'all 0.15s ease'
                                    }}
                                    className="list-btn-hover"
                                >
                                    <Bookmark size={14} style={{ opacity: active ? 1 : 0.4, color: active ? '#6366f1' : 'inherit' }} />
                                    <span style={{ flex: 1 }}>{list.name}</span>
                                    <ChevronRight size={12} style={{ opacity: active ? 0.7 : 0, transition: 'all 0.15s' }} />
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom Lists Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 12px 10px 12px',
                        fontSize: '0.68rem', fontWeight: 800,
                        color: 'var(--text-secondary, #8696a0)',
                        textTransform: 'uppercase', letterSpacing: '0.8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Bookmark size={11} />
                            <span>Listas Personalizadas</span>
                        </div>
                        <button
                            onClick={handleOpenCreateModal}
                            style={{
                                background: 'rgba(99,102,241,0.1)', border: 'none',
                                color: '#6366f1', width: 20, height: 20,
                                borderRadius: 6, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            title="Nova Lista Personalizada"
                        >
                            <Plus size={12} />
                        </button>
                    </div>

                    {/* Custom Lists Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {customLists.map(list => {
                            const active = selectedListId === list.id;
                            return (
                                <div
                                    key={list.id}
                                    onClick={() => handleSelectList(list.id, list.filters)}
                                    style={{
                                        display: 'flex', alignItems: 'center',
                                        padding: '8px 12px', borderRadius: 10,
                                        background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                                        color: active ? '#6366f1' : 'var(--text-primary, #4b5563)',
                                        fontSize: '0.85rem', fontWeight: active ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                    className="list-btn-hover"
                                >
                                    <Bookmark size={14} style={{ opacity: active ? 1 : 0.4, color: active ? '#6366f1' : 'inherit', marginRight: 10 }} />
                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{list.name}</span>
                                    
                                    {/* Action buttons visible on hover */}
                                    <div 
                                        className="list-actions"
                                        style={{ 
                                            display: 'flex', gap: 6, opacity: 0, 
                                            transition: 'opacity 0.15s ease' 
                                        }}
                                    >
                                        <button
                                            onClick={(e) => handleOpenEditModal(list, e)}
                                            style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 2 }}
                                            title="Editar Lista"
                                        >
                                            <Edit3 size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteList(list.id, list.name, e)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}
                                            title="Excluir Lista"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {customLists.length === 0 && (
                            <div style={{
                                padding: '12px 14px', textAlign: 'center', fontSize: '0.78rem',
                                color: 'var(--text-secondary, #9ca3af)', border: '1px dashed var(--border, #e5e7eb)',
                                borderRadius: 10, margin: '0 8px'
                            }}>
                                Crie listas com filtros específicos clicando no "+" acima.
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Main Content Container ─── */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    
                    {/* Mobile Only: List Selector Dropdown */}
                    <div 
                        className="tickets-mobile-selector"
                        style={{
                            padding: '10px 20px',
                            background: 'var(--bg-secondary, #fff)',
                            borderBottom: '1px solid var(--border, #e5e7eb)',
                            display: 'none'
                        }}
                    >
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', marginBottom: 4 }}>
                            Filas & Listas de Atendimento
                        </label>
                        <select
                            value={selectedListId}
                            onChange={(e) => {
                                const id = e.target.value;
                                if (id === "new_custom") {
                                    handleOpenCreateModal();
                                    return;
                                }
                                const sys = systemLists.find(l => l.id === id);
                                if (sys) {
                                    handleSelectList(sys.id, sys.filters);
                                    return;
                                }
                                const cust = customLists.find(l => l.id === id);
                                if (cust) {
                                    handleSelectList(cust.id, cust.filters);
                                }
                            }}
                            style={{
                                width: '100%', padding: '8px 10px', borderRadius: 8,
                                background: 'var(--bg-primary, #f3f4f6)', border: '1px solid var(--border, #e5e7eb)',
                                color: 'var(--text-primary, #1f2937)', fontSize: '0.82rem',
                                outline: 'none'
                            }}
                        >
                            <optgroup label="Listas Padrão">
                                {systemLists.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </optgroup>
                            {customLists.length > 0 && (
                                <optgroup label="Minhas Listas">
                                    {customLists.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </optgroup>
                            )}
                            <option value="new_custom">+ Criar nova lista personalizada...</option>
                        </select>
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {viewMode === 'kanban' ? (
                            <Kanban
                                onSelectTicket={handleKanbanSelect}
                                refreshKey={refreshKey}
                                onStatsUpdate={handleStatsUpdate}
                                filters={filters}
                            />
                        ) : (
                            <TicketList
                                onSelect={setSelectedTicket}
                                selectedId={null}
                                onBack={onBack}
                                refreshKey={refreshKey}
                                onStatsUpdate={handleStatsUpdate}
                                filters={filters}
                                onFiltersChange={handleFilterChange}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Modal to Create/Edit Custom List ─── */}
            {modalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyItems: 'center',
                    justifyContent: 'center', zIndex: 9999
                }}>
                    <form 
                        onSubmit={handleSaveCustomList}
                        style={{
                            background: 'var(--bg-secondary, #fff)',
                            width: '100%', maxWidth: 440,
                            borderRadius: 20, padding: 25,
                            border: '1px solid var(--border, #e5e7eb)',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                            display: 'flex', flexDirection: 'column', gap: 16
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {editingList ? 'Editar Lista Personalizada' : 'Nova Lista Personalizada'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                style={{
                                    background: 'var(--bg-primary, #f3f4f6)', border: 'none',
                                    borderRadius: '50%', width: 28, height: 28,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: 'var(--text-secondary, #6b7280)'
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* List Name */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Nome da Lista</label>
                            <input
                                placeholder="Ex: WhatsApp Pendente"
                                value={listName}
                                onChange={e => setListName(e.target.value)}
                                required
                                autoComplete="off"
                                data-lpignore="true"
                                data-1p-ignore
                                style={{
                                    padding: '10px 12px', borderRadius: 10,
                                    border: '1.5px solid var(--border, #e5e7eb)',
                                    background: 'var(--bg-primary, #f9fafb)',
                                    color: 'var(--text-primary)', fontSize: '0.88rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Status Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Status</label>
                            <select
                                value={listStatus}
                                onChange={e => setListStatus(e.target.value)}
                                style={{
                                    padding: '8px 10px', borderRadius: 8,
                                    border: '1.5px solid var(--border, #e5e7eb)',
                                    background: 'var(--bg-primary, #f9fafb)',
                                    color: 'var(--text-primary)', fontSize: '0.82rem',
                                    outline: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="ALL">Todos Status</option>
                                <option value="OPEN">Aberto</option>
                                <option value="RESOLVED">Fechado</option>
                                <option value="PENDING">Pendente</option>
                            </select>
                        </div>

                        {/* Channel Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Canal de Origem</label>
                            <select
                                value={listChannel}
                                onChange={e => setListChannel(e.target.value)}
                                style={{
                                    padding: '8px 10px', borderRadius: 8,
                                    border: '1.5px solid var(--border, #e5e7eb)',
                                    background: 'var(--bg-primary, #f9fafb)',
                                    color: 'var(--text-primary)', fontSize: '0.82rem',
                                    outline: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="ALL">Todos Canais</option>
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Plataforma">Plataforma</option>
                                <option value="Chatbot">Chatbot</option>
                                <option value="Email">Email</option>
                            </select>
                        </div>

                        {/* Assignee Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Responsável (Técnico)</label>
                            <select
                                value={listAssignee}
                                onChange={e => setListAssignee(e.target.value)}
                                style={{
                                    padding: '8px 10px', borderRadius: 8,
                                    border: '1.5px solid var(--border, #e5e7eb)',
                                    background: 'var(--bg-primary, #f9fafb)',
                                    color: 'var(--text-primary)', fontSize: '0.82rem',
                                    outline: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="ALL">Qualquer um</option>
                                <option value="ME">Atribuído a Mim (Logado)</option>
                                <option value="UNASSIGNED">Não atribuído</option>
                            </select>
                        </div>

                        {/* SLA Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Prazo do SLA</label>
                            <select
                                value={listSla}
                                onChange={e => setListSla(e.target.value)}
                                style={{
                                    padding: '8px 10px', borderRadius: 8,
                                    border: '1.5px solid var(--border, #e5e7eb)',
                                    background: 'var(--bg-primary, #f9fafb)',
                                    color: 'var(--text-primary)', fontSize: '0.82rem',
                                    outline: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="ALL">Todos Prazos</option>
                                <option value="VIOLATED">SLA Estourado / Atrasado</option>
                                <option value="WARNING">SLA Em Risco</option>
                                <option value="ON_TIME">SLA No Prazo</option>
                            </select>
                        </div>

                        {/* Priority Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Prioridade</label>
                            <select
                                value={listPriority}
                                onChange={e => setListPriority(e.target.value)}
                                style={{
                                    padding: '8px 10px', borderRadius: 8,
                                    border: '1.5px solid var(--border, #e5e7eb)',
                                    background: 'var(--bg-primary, #f9fafb)',
                                    color: 'var(--text-primary)', fontSize: '0.82rem',
                                    outline: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="ALL">Todas Prioridades</option>
                                <option value="LOW">Baixa</option>
                                <option value="MEDIUM">Média</option>
                                <option value="HIGH">Alta</option>
                                <option value="CRITICAL">Crítica</option>
                            </select>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: 10,
                                    background: 'var(--bg-primary, #f3f4f6)', border: 'none',
                                    color: 'var(--text-primary)', fontSize: '0.88rem',
                                    fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                style={{
                                    flex: 1, padding: '10px', borderRadius: 10,
                                    background: '#6366f1', border: 'none',
                                    color: '#fff', fontSize: '0.88rem',
                                    fontWeight: 700, cursor: 'pointer',
                                    boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)'
                                }}
                            >
                                Salvar Lista
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
