import React, { useState, useEffect } from "react";
import { ArrowLeft, Clock, Save } from "lucide-react";
import { api } from "./lib/api";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface BusinessHour {
    DayOfWeek: number;
    StartTime: string;
    EndTime: string;
    IsActive: boolean;
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
    const [offHoursMessage, setOffHoursMessage] = useState("Olá! No momento estamos fora do horário de atendimento. Retornaremos em breve.");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/api/business-hours")
            .then(res => {
                const data = res.data;
                if (data.hours && data.hours.length > 0) {
                    // Merge with defaults for any missing days
                    const merged = DEFAULT_HOURS.map(d => {
                        const found = data.hours.find((h: BusinessHour) => h.DayOfWeek === d.DayOfWeek);
                        return found || d;
                    });
                    setHours(merged);
                }
                if (data.offHoursMessage) setOffHoursMessage(data.offHoursMessage);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

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

    if (loading) return <div style={{ padding: 20, color: "var(--text-primary)" }}>Carregando...</div>;

    return (
        <div style={{ padding: 30, color: "var(--text-primary)", overflowY: "auto", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
                <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginRight: 15 }}>
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
                        <Clock size={24} color="#00a884" /> Horário de Atendimento
                    </h2>
                    <p style={{ margin: "5px 0 0 0", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                        Configure o expediente e a mensagem automática fora do horário.
                    </p>
                </div>
            </div>

            {/* Weekly Schedule */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", padding: 25, marginBottom: 25 }}>
                <h3 style={{ margin: "0 0 20px 0", fontSize: "1.05rem" }}>Expediente Semanal</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {hours.map(h => (
                        <div key={h.DayOfWeek} style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 15,
                            padding: "12px 16px",
                            borderRadius: 8,
                            background: h.IsActive ? "var(--bg-primary)" : "transparent",
                            border: `1px solid ${h.IsActive ? "var(--border)" : "transparent"}`,
                            opacity: h.IsActive ? 1 : 0.5
                        }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, width: 130, cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={h.IsActive}
                                    onChange={e => updateDay(h.DayOfWeek, "IsActive", e.target.checked)}
                                    style={{ width: 18, height: 18, accentColor: "#00a884" }}
                                />
                                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{DAY_NAMES[h.DayOfWeek]}</span>
                            </label>
                            <input
                                type="time"
                                value={h.StartTime}
                                onChange={e => updateDay(h.DayOfWeek, "StartTime", e.target.value)}
                                disabled={!h.IsActive}
                                style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                            />
                            <span style={{ color: "var(--text-secondary)" }}>até</span>
                            <input
                                type="time"
                                value={h.EndTime}
                                onChange={e => updateDay(h.DayOfWeek, "EndTime", e.target.value)}
                                disabled={!h.IsActive}
                                style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Off-hours message */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", padding: 25, marginBottom: 25 }}>
                <h3 style={{ margin: "0 0 15px 0", fontSize: "1.05rem" }}>Mensagem Fora do Horário</h3>
                <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Enviada automaticamente quando um cliente envia mensagem fora do expediente.
                </p>
                <textarea
                    value={offHoursMessage}
                    onChange={e => setOffHoursMessage(e.target.value)}
                    style={{
                        width: "100%", minHeight: 100, padding: 12, borderRadius: 8,
                        border: "1px solid var(--border)", background: "var(--bg-primary)",
                        color: "var(--text-primary)", resize: "vertical", fontFamily: "inherit",
                        fontSize: 14, boxSizing: "border-box"
                    }}
                />
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 32px", fontSize: "1rem", fontWeight: 600 }}
            >
                <Save size={18} /> {saving ? "Salvando..." : "Salvar Configurações"}
            </button>
        </div>
    );
}
