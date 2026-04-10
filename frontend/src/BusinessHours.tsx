import React, { useState, useEffect } from "react";
import { ArrowLeft, Clock, Save, Calendar, Plus, Trash2, AlertCircle } from "lucide-react";
import { PageHeader } from "./components/PageHeader";
import { api } from "./lib/api";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface BusinessHour {
    DayOfWeek: number;
    StartTime: string;
    EndTime: string;
    IsActive: boolean;
}

interface BusinessException {
    ExceptionId: string;
    Date: string;
    Description: string;
    IsOpen: boolean;
    StartTime?: string | null;
    EndTime?: string | null;
}

const DEFAULT_HOURS: BusinessHour[] = DAY_NAMES.map((_, i) => ({
    DayOfWeek: i,
    StartTime: "08:00",
    EndTime: "18:00",
    IsActive: i >= 1 && i <= 5 // Mon-Fri active by default
}));

interface Props {
    onBack: () => void;
}

export function BusinessHours({ onBack }: Props) {
    const [hours, setHours] = useState<BusinessHour[]>(DEFAULT_HOURS);
    const [exceptions, setExceptions] = useState<BusinessException[]>([]);
    const [offHoursMessage, setOffHoursMessage] = useState("Olá! No momento estamos fora do horário de atendimento. Retornaremos em breve.");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [exceptionsLoading, setExceptionsLoading] = useState(false);

    // New Exception Form State
    const [newExcDate, setNewExcDate] = useState("");
    const [newExcDesc, setNewExcDesc] = useState("");
    const [newExcIsOpen, setNewExcIsOpen] = useState(false);
    const [newExcStart, setNewExcStart] = useState("08:00");
    const [newExcEnd, setNewExcEnd] = useState("18:00");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/business-hours");
            const data = res.data;
            if (data.hours && data.hours.length > 0) {
                const merged = DEFAULT_HOURS.map(d => {
                    const found = data.hours.find((h: BusinessHour) => h.DayOfWeek === d.DayOfWeek);
                    return found || d;
                });
                setHours(merged);
            }
            if (data.offHoursMessage) setOffHoursMessage(data.offHoursMessage);

            const excRes = await api.get("/api/business-hours/exceptions");
            setExceptions(excRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateDay = (dayIndex: number, field: keyof BusinessHour, value: any) => {
        setHours(prev => prev.map(h =>
            h.DayOfWeek === dayIndex ? { ...h, [field]: value } : h
        ));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put("/api/business-hours", { hours, offHoursMessage });
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleAddException = async () => {
        if (!newExcDate) return;
        setExceptionsLoading(true);
        try {
            await api.post("/api/business-hours/exceptions", {
                date: newExcDate,
                description: newExcDesc,
                isOpen: newExcIsOpen,
                startTime: newExcIsOpen ? newExcStart : null,
                endTime: newExcIsOpen ? newExcEnd : null
            });
            setNewExcDate("");
            setNewExcDesc("");
            setNewExcIsOpen(false);
            const excRes = await api.get("/api/business-hours/exceptions");
            setExceptions(excRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setExceptionsLoading(false);
        }
    };

    const handleDeleteException = async (id: string) => {
        try {
            await api.delete(`/api/business-hours/exceptions/${id}`);
            setExceptions(prev => prev.filter(e => e.ExceptionId !== id));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div style={{ padding: 20, color: "var(--text-primary)" }}>Carregando...</div>;

    return (
        <div className="settings-page" style={{ height: "100%", overflowY: "auto", paddingBottom: 100 }}>
            <PageHeader
                title="Horário de Atendimento"
                subtitle="Configure o expediente semanal e datas especiais (feriados)."
                icon={Clock}
                onBack={onBack}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24 }}>
                {/* Weekly Schedule */}
                <div style={{ background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)", padding: 25, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: "0 0 20px 0", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                        <Clock size={20} color="var(--accent)" /> Expediente Semanal
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {hours.map(h => (
                            <div key={h.DayOfWeek} style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "10px 14px",
                                borderRadius: 10,
                                background: h.IsActive ? "var(--bg-primary)" : "rgba(0,0,0,0.02)",
                                border: `1px solid ${h.IsActive ? "var(--border)" : "transparent"}`,
                                transition: "all 0.2s"
                            }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 10, width: 140, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={h.IsActive}
                                        onChange={e => updateDay(h.DayOfWeek, "IsActive", e.target.checked)}
                                        style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                                    />
                                    <span style={{ fontWeight: 600, fontSize: "0.9rem", color: h.IsActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
                                        {DAY_NAMES[h.DayOfWeek]}
                                    </span>
                                </label>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: h.IsActive ? 1 : 0.3 }}>
                                    <input
                                        type="time"
                                        value={h.StartTime}
                                        onChange={e => updateDay(h.DayOfWeek, "StartTime", e.target.value)}
                                        disabled={!h.IsActive}
                                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
                                    />
                                    <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>até</span>
                                    <input
                                        type="time"
                                        value={h.EndTime}
                                        onChange={e => updateDay(h.DayOfWeek, "EndTime", e.target.value)}
                                        disabled={!h.IsActive}
                                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Exceptions / Holidays */}
                <div style={{ background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)", padding: 25, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: "0 0 20px 0", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                        <Calendar size={20} color="var(--accent)" /> Feriados e Exceções
                    </h3>
                    
                    {/* Add Form */}
                    <div style={{ 
                        background: "var(--bg-primary)", borderRadius: 12, padding: 18, 
                        border: "1px solid var(--border)", marginBottom: 20,
                        display: "flex", flexDirection: "column", gap: 12
                    }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>Data</label>
                                <input 
                                    type="date" 
                                    value={newExcDate} 
                                    onChange={e => setNewExcDate(e.target.value)}
                                    style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>Descrição (ex: Natal)</label>
                                <input 
                                    type="text" 
                                    placeholder="Nome do evento"
                                    value={newExcDesc} 
                                    onChange={e => setNewExcDesc(e.target.value)}
                                    style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }}
                                />
                            </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: 8 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                                <input 
                                    type="checkbox" 
                                    checked={newExcIsOpen} 
                                    onChange={e => setNewExcIsOpen(e.target.checked)}
                                    style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                                />
                                Empresa Aberta nesta data?
                            </label>
                            
                            {newExcIsOpen && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input 
                                        type="time" 
                                        value={newExcStart} 
                                        onChange={e => setNewExcStart(e.target.value)}
                                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", fontSize: 12 }}
                                    />
                                    <span style={{ fontSize: 12 }}>-</span>
                                    <input 
                                        type="time" 
                                        value={newExcEnd} 
                                        onChange={e => setNewExcEnd(e.target.value)}
                                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", fontSize: 12 }}
                                    />
                                </div>
                            )}
                        </div>

                        <button 
                            className="btn btn-primary"
                            disabled={!newExcDate || exceptionsLoading}
                            onClick={handleAddException}
                            style={{ 
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, 
                                padding: "10px", fontSize: "0.85rem", marginTop: 4, width: "100%"
                            }}
                        >
                            <Plus size={16} /> Adicionar Exceção
                        </button>
                    </div>

                    {/* Exceptions List */}
                    <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                        {exceptions.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                Nenhuma data especial cadastrada.
                            </div>
                        ) : (
                            exceptions.map(e => (
                                <div key={e.ExceptionId} style={{ 
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "12px 16px", borderRadius: 10, background: "var(--bg-primary)",
                                    border: "1px solid var(--border)"
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                                            {new Date(e.Date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                            {e.Description || 'Exceção'} • <span style={{ color: e.IsOpen ? "var(--accent)" : "var(--danger)", fontWeight: 600 }}>
                                                {e.IsOpen ? `Aberto (${e.StartTime} - ${e.EndTime})` : 'Fechado'}
                                            </span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteException(e.ExceptionId)}
                                        style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 8 }}
                                        title="Remover"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Off-hours message */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border)", padding: 25, marginTop: 24, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                <h3 style={{ margin: "0 0 15px 0", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                    <AlertCircle size={20} color="var(--accent)" /> Mensagem Fora do Horário
                </h3>
                <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Enviada automaticamente quando um cliente envia mensagem fora do expediente.
                </p>
                <textarea
                    value={offHoursMessage}
                    onChange={e => setOffHoursMessage(e.target.value)}
                    style={{
                        width: "100%", minHeight: 80, padding: 15, borderRadius: 12,
                        border: "1px solid var(--border)", background: "var(--bg-primary)",
                        color: "var(--text-primary)", resize: "vertical", fontFamily: "inherit",
                        fontSize: 14, boxSizing: "border-box", transition: "border 0.2s"
                    }}
                />
            </div>

            <div style={{ marginTop: 30, display: "flex", justifyContent: "flex-end" }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 40px", fontSize: "1rem", fontWeight: 700, borderRadius: 12 }}
                >
                    <Save size={20} /> {saving ? "Salvando..." : "Salvar Todas as Configurações"}
                </button>
            </div>
        </div>
    );
}
