import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { Loader2, GripVertical, User, ArrowUpRight, Edit3 } from 'lucide-react';

export interface KanbanTicket {
    id: string;
    conversationId: string;
    title: string;
    status: string;
    priority: string;
    slaStatus: string;
    escalationLevel: number;
    kanbanOrder: number;
    assignedAgent?: { name: string } | null;
    requester?: { name: string } | null;
}

const defaultColumns = [
    { key: 'NEW', title: 'Novo', accent: '#6366f1' },
    { key: 'TRIAGE', title: 'Em triagem', accent: '#8b5cf6' },
    { key: 'IN_PROGRESS', title: 'Em atendimento', accent: '#3b82f6' },
    { key: 'WAITING_CUSTOMER', title: 'Aguardando cliente', accent: '#f59e0b' },
    { key: 'WAITING_THIRD_PARTY', title: 'Aguardando terceiro', accent: '#f97316' },
    { key: 'ESCALATED', title: 'Escalado', accent: '#ef4444' },
    { key: 'RESOLVED', title: 'Resolvido', accent: '#10b981' },
];

function getSLAStyle(status: string): React.CSSProperties {
    const base: React.CSSProperties = { padding: '2px 8px', borderRadius: 6, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' };
    if (status === 'BREACHED') return { ...base, background: 'rgba(239,68,68,0.12)', color: '#dc2626' };
    if (status === 'WARNING') return { ...base, background: 'rgba(245,158,11,0.12)', color: '#d97706' };
    return { ...base, background: 'rgba(16,185,129,0.12)', color: '#059669' };
}

function getPriorityDot(priority: string): string {
    switch (priority) {
        case 'CRITICAL': return '#ef4444';
        case 'HIGH': return '#f97316';
        case 'MEDIUM': return '#3b82f6';
        case 'LOW': return '#9ca3af';
        default: return '#9ca3af';
    }
}

function getPriorityLabel(priority: string): string {
    switch (priority) {
        case 'CRITICAL': return 'Crítica';
        case 'HIGH': return 'Alta';
        case 'MEDIUM': return 'Média';
        case 'LOW': return 'Baixa';
        default: return priority;
    }
}

interface KanbanProps {
    onSelectTicket: (ticketId: string) => void;
    refreshKey?: number;
    onStatsUpdate?: (stats: { total: number; breached: number; warning: number; onTime: number }) => void;
}

export function Kanban({ onSelectTicket, refreshKey, onStatsUpdate }: KanbanProps) {
    const [tickets, setTickets] = useState<KanbanTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [kanbanColumns, setKanbanColumns] = useState(defaultColumns);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [editingColKey, setEditingColKey] = useState<string | null>(null);
    const [editingColTitle, setEditingColTitle] = useState('');

    const fetchTickets = useCallback(() => {
        api.get('/api/tickets/kanban')
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : [];
                setTickets(data);
                if (onStatsUpdate) {
                    onStatsUpdate({
                        total: data.length,
                        breached: data.filter((t: KanbanTicket) => t.slaStatus === 'BREACHED').length,
                        warning: data.filter((t: KanbanTicket) => t.slaStatus === 'WARNING').length,
                        onTime: data.filter((t: KanbanTicket) => t.slaStatus === 'ON_TIME').length,
                    });
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [onStatsUpdate]);

    useEffect(() => {
        setLoading(true);
        fetchTickets();
        
        // Buscar configurações dinâmicas de colunas
        api.get('/api/settings/tenant').then(res => {
            if (res.data.KanbanColumnsJson) {
                try {
                    const customNames = JSON.parse(res.data.KanbanColumnsJson);
                    setKanbanColumns(prev => prev.map(col => ({
                        ...col,
                        title: customNames[col.key] || col.title
                    })));
                } catch (e) { console.error("Error parsing kanban columns config", e); }
            }
        }).catch(err => console.warn("Could not load tenant settings for kanban", err));
    }, [refreshKey, fetchTickets]);

    const refreshSilent = () => {
        api.get('/api/tickets/kanban')
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : [];
                setTickets(data);
                if (onStatsUpdate) {
                    onStatsUpdate({
                        total: data.length,
                        breached: data.filter((t: KanbanTicket) => t.slaStatus === 'BREACHED').length,
                        warning: data.filter((t: KanbanTicket) => t.slaStatus === 'WARNING').length,
                        onTime: data.filter((t: KanbanTicket) => t.slaStatus === 'ON_TIME').length,
                    });
                }
            })
            .catch(console.error);
    };

    async function moveTicket(ticketId: string, targetStatus: string) {
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: targetStatus } : t));
        try {
            await api.patch(`/api/tickets/${ticketId}/status`, { status: targetStatus });
            refreshSilent();
        } catch (error) {
            console.error('Failed to move ticket', error);
            refreshSilent();
        }
    }

    async function saveColumnTitle(columnKey: string) {
        const trimmed = editingColTitle.trim();
        if (!trimmed) { setEditingColKey(null); return; }
        
        setKanbanColumns(prev => prev.map(col => col.key === columnKey ? { ...col, title: trimmed } : col));
        setEditingColKey(null);

        try {
            const updatedColumns = kanbanColumns.reduce((acc, col) => {
                acc[col.key] = col.key === columnKey ? trimmed : col.title;
                return acc;
            }, {} as Record<string, string>);

            await api.put('/api/settings/tenant', { kanbanColumns: updatedColumns });
        } catch (error) {
            console.error('Failed to save column title', error);
        }
    }

    async function saveTitle(ticketId: string) {
        const trimmed = editingTitle.trim();
        if (!trimmed) { setEditingId(null); return; }
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, title: trimmed } : t));
        setEditingId(null);
        try {
            await api.patch(`/api/tickets/${ticketId}/title`, { title: trimmed });
        } catch (error) {
            console.error('Failed to save title', error);
            refreshSilent();
        }
    }

    if (loading) {
        return (
            <div style={{
                flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-primary, #f4f6f8)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#6366f1', marginBottom: 8 }} />
                    <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.85rem', margin: 0 }}>Carregando tickets...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            background: 'var(--bg-primary, #f4f6f8)'
        }}>
            {/* Board */}
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '16px 16px 16px 16px' }}>
                <div style={{
                    display: 'flex', gap: 12, height: '100%', minWidth: 'max-content',
                    paddingBottom: 4 /* room for scrollbar */
                }}>
                    {kanbanColumns.map(column => {
                        const columnTickets = tickets.filter(t => {
                            if (column.key === 'NEW') return t.status === 'NEW' || t.status === 'OPEN';
                            return t.status === column.key;
                        });
                        const breachedCount = columnTickets.filter(t => t.slaStatus === 'BREACHED').length;
                        const isDragOver = dragOverColumn === column.key;

                        return (
                            <div
                                key={column.key}
                                style={{
                                    background: isDragOver
                                        ? 'rgba(99,102,241,0.04)'
                                        : 'var(--bg-secondary, #fff)',
                                    border: isDragOver
                                        ? '2px solid rgba(99,102,241,0.3)'
                                        : '1px solid var(--border, #e5e7eb)',
                                    borderRadius: 16,
                                    display: 'flex', flexDirection: 'column',
                                    width: 280, minWidth: 260,
                                    height: '100%',
                                    transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                                    boxShadow: isDragOver ? '0 0 0 4px rgba(99,102,241,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                                    overflow: 'hidden'
                                }}
                                onDragOver={e => { e.preventDefault(); setDragOverColumn(column.key); }}
                                onDragLeave={() => setDragOverColumn(null)}
                                onDrop={e => {
                                    e.preventDefault();
                                    setDragOverColumn(null);
                                    const ticketId = e.dataTransfer.getData('ticketId');
                                    if (ticketId) {
                                        moveTicket(ticketId, column.key);
                                    }
                                }}
                            >
                                {/* Column Header */}
                                <div style={{
                                    padding: '12px 14px',
                                    borderBottom: '1px solid var(--border, #e5e7eb)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'var(--bg-secondary, #fff)',
                                    position: 'relative'
                                }}>
                                    {/* Accent top bar */}
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                                        background: column.accent,
                                        borderRadius: '16px 16px 0 0',
                                        opacity: 0.8
                                    }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {editingColKey === column.key ? (
                                            <input
                                                autoFocus
                                                value={editingColTitle}
                                                onChange={e => setEditingColTitle(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveColumnTitle(column.key);
                                                    if (e.key === 'Escape') setEditingColKey(null);
                                                }}
                                                onBlur={() => saveColumnTitle(column.key)}
                                                style={{
                                                    fontSize: '0.82rem', fontWeight: 700,
                                                    color: 'var(--text-primary, #374151)',
                                                    background: 'var(--bg-primary, #f3f4f6)',
                                                    border: '1.5px solid #6366f1',
                                                    borderRadius: 6, padding: '2px 6px',
                                                    outline: 'none', width: 140
                                                }}
                                            />
                                        ) : (
                                            <div 
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                                                onDoubleClick={() => {
                                                    setEditingColKey(column.key);
                                                    setEditingColTitle(column.title);
                                                }}
                                                onMouseEnter={e => {
                                                    const pencil = e.currentTarget.querySelector('.col-edit-pencil') as HTMLElement;
                                                    if (pencil) pencil.style.opacity = '0.7';
                                                }}
                                                onMouseLeave={e => {
                                                    const pencil = e.currentTarget.querySelector('.col-edit-pencil') as HTMLElement;
                                                    if (pencil) pencil.style.opacity = '0';
                                                }}
                                            >
                                                <h2 style={{
                                                    margin: 0, fontWeight: 700,
                                                    color: 'var(--text-primary, #374151)',
                                                    fontSize: '0.82rem'
                                                }}>
                                                    {column.title}
                                                </h2>
                                                <Edit3
                                                    size={12}
                                                    className="col-edit-pencil"
                                                    style={{ 
                                                        opacity: 0, cursor: 'pointer',
                                                        color: '#6366f1', transition: 'all 0.2s'
                                                    }}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setEditingColKey(column.key);
                                                        setEditingColTitle(column.title);
                                                    }}
                                                    title="Editar título da coluna"
                                                />
                                            </div>
                                        )}
                                        <span style={{
                                            background: columnTickets.length > 0 ? column.accent : 'var(--bg-primary, #e5e7eb)',
                                            color: columnTickets.length > 0 ? '#fff' : 'var(--text-secondary, #9ca3af)',
                                            fontSize: '0.68rem', fontWeight: 700,
                                            padding: '2px 8px', borderRadius: 10,
                                            minWidth: 22, textAlign: 'center'
                                        }}>
                                            {columnTickets.length}
                                        </span>
                                    </div>
                                    {breachedCount > 0 && (
                                        <span style={{
                                            fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.3px',
                                            color: '#dc2626', background: 'rgba(239,68,68,0.08)', fontWeight: 700,
                                            padding: '2px 8px', borderRadius: 8
                                        }}>
                                            {breachedCount} SLA!
                                        </span>
                                    )}
                                </div>

                                {/* Cards */}
                                <div style={{
                                    padding: 10, flex: 1, overflowY: 'auto',
                                    display: 'flex', flexDirection: 'column', gap: 8
                                }}>
                                    {columnTickets.map(ticket => (
                                        <div
                                            key={ticket.id}
                                            draggable
                                            onDragStart={e => {
                                                e.dataTransfer.setData('ticketId', ticket.id);
                                                setDraggedId(ticket.id);
                                            }}
                                            onDragEnd={() => setDraggedId(null)}
                                            onClick={e => {
                                                const target = e.target as HTMLElement;
                                                if (
                                                    target.closest('.no-select-card') || 
                                                    target.closest('input') || 
                                                    target.tagName === 'INPUT'
                                                ) {
                                                    return;
                                                }
                                                onSelectTicket(ticket.conversationId);
                                            }}
                                            style={{
                                                background: 'var(--bg-secondary, #fff)',
                                                border: draggedId === ticket.id
                                                    ? '1.5px solid rgba(99,102,241,0.4)'
                                                    : '1px solid var(--border, #e5e7eb)',
                                                borderRadius: 12, padding: '12px 14px',
                                                cursor: 'grab',
                                                transition: 'all 0.2s ease',
                                                boxShadow: draggedId === ticket.id
                                                    ? '0 8px 25px rgba(99,102,241,0.15)'
                                                    : '0 1px 2px rgba(0,0,0,0.04)',
                                                opacity: draggedId === ticket.id ? 0.7 : 1,
                                                position: 'relative'
                                            }}
                                            onMouseEnter={e => {
                                                if (draggedId) return;
                                                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)';
                                                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                                                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                                                const btn = e.currentTarget.querySelector('.edit-pencil') as HTMLElement;
                                                if (btn) btn.style.opacity = '0.8';
                                            }}
                                            onMouseLeave={e => {
                                                if (draggedId) return;
                                                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border, #e5e7eb)';
                                                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                                                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                                                const btn = e.currentTarget.querySelector('.edit-pencil') as HTMLElement;
                                                if (btn) btn.style.opacity = '0.2';
                                            }}
                                        >
                                            {/* Card header: priority dot + title */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                                                <div style={{
                                                    width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                                                    background: getPriorityDot(ticket.priority),
                                                    boxShadow: `0 0 0 3px ${getPriorityDot(ticket.priority)}20`
                                                }} />
                                                {editingId === ticket.id ? (
                                                    <input
                                                        autoFocus
                                                        value={editingTitle}
                                                        onChange={e => setEditingTitle(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') saveTitle(ticket.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                        onBlur={() => saveTitle(ticket.id)}
                                                        onClick={e => e.stopPropagation()}
                                                        style={{
                                                            flex: 1, fontSize: '0.85rem', fontWeight: 600,
                                                            color: 'var(--text-primary, #1f2937)',
                                                            background: 'var(--bg-primary, #f3f4f6)',
                                                            border: '1.5px solid #6366f1',
                                                            borderRadius: 6, padding: '4px 8px',
                                                            outline: 'none', minWidth: 0
                                                        }}
                                                    />
                                                ) : (
                                                    <div 
                                                        className="no-select-card"
                                                        style={{
                                                            flex: 1, display: 'flex', alignItems: 'flex-start', gap: 6,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <div
                                                            onDoubleClick={e => {
                                                                e.stopPropagation();
                                                                setEditingId(ticket.id);
                                                                setEditingTitle(ticket.title || '');
                                                            }}
                                                            style={{
                                                                fontSize: '0.85rem', fontWeight: 600,
                                                                color: 'var(--text-primary, #1f2937)',
                                                                lineHeight: 1.35, flex: 1,
                                                                overflow: 'hidden', textOverflow: 'ellipsis',
                                                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                                                            }}
                                                            title="Duplo-clique para editar"
                                                        >
                                                            {ticket.title || ticket.requester?.name || 'Sem título'}
                                                        </div>
                                                        <Edit3
                                                            size={13}
                                                            className="edit-pencil"
                                                            style={{ 
                                                                flexShrink: 0, marginTop: 2, 
                                                                opacity: 0.2, cursor: 'pointer',
                                                                color: '#6366f1', transition: 'all 0.2s'
                                                            }}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                setEditingId(ticket.id);
                                                                setEditingTitle(ticket.title || '');
                                                            }}
                                                            title="Editar título"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Requester */}
                                            {ticket.requester?.name && ticket.title && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                    fontSize: '0.73rem', color: 'var(--text-secondary, #6b7280)',
                                                    marginBottom: 4
                                                }}>
                                                    <User size={11} style={{ opacity: 0.6 }} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {ticket.requester.name}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Agent */}
                                            {ticket.assignedAgent && (
                                                <div style={{
                                                    fontSize: '0.72rem', color: 'var(--text-secondary, #4b5563)',
                                                    marginBottom: 6,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                }}>
                                                    → {ticket.assignedAgent.name}
                                                </div>
                                            )}

                                            {/* Footer: Priority + SLA */}
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                marginTop: 8, paddingTop: 8,
                                                borderTop: '1px solid var(--border, #f3f4f6)'
                                            }}>
                                                <span style={{
                                                    fontSize: '0.62rem', fontWeight: 700, color: getPriorityDot(ticket.priority),
                                                    textTransform: 'uppercase', letterSpacing: '0.3px'
                                                }}>
                                                    {getPriorityLabel(ticket.priority)}
                                                </span>
                                                <span style={getSLAStyle(ticket.slaStatus)}>
                                                    {ticket.slaStatus === 'BREACHED' ? '⚠ SLA' : ticket.slaStatus === 'WARNING' ? '⏳ SLA' : '✓ SLA'}
                                                </span>
                                            </div>

                                            {/* Escalation badge */}
                                            {ticket.escalationLevel > 0 && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                                    fontSize: '0.6rem', background: 'rgba(239,68,68,0.06)', color: '#dc2626',
                                                    border: '1px solid rgba(239,68,68,0.15)', fontWeight: 700, marginTop: 8,
                                                    padding: '4px 8px', borderRadius: 8,
                                                    textTransform: 'uppercase', letterSpacing: '0.3px'
                                                }}>
                                                    <ArrowUpRight size={11} />
                                                    Escalado Nível {ticket.escalationLevel}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {columnTickets.length === 0 && (
                                        <div style={{
                                            height: 80, border: '2px dashed var(--border, #d1d5db)', borderRadius: 12,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'var(--text-secondary, #9ca3af)', fontSize: '0.78rem',
                                            opacity: 0.6
                                        }}>
                                            Arraste aqui
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}