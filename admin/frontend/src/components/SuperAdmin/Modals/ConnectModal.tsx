import React, { useState } from "react";
import { Smartphone, QrCode } from "lucide-react";
import { api } from "../../../lib/api";

interface ConnectModalProps {
    connectorId: string;
    onClose: () => void;
}

export function ConnectModal({ connectorId, onClose }: ConnectModalProps) {
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleConnect = async (usePhone: boolean) => {
        setLoading(true);
        setResult(null);
        try {
            const payload = usePhone ? { phone } : {};
            const r = await api.post(`/api/admin/instances/${connectorId}/connect`, payload);
            setResult(r.data);
        } catch (err: any) {
            console.error(err);
            alert("Erro ao tentar conectar: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
            <div className="admin-modal" style={{
                background: "var(--bg-secondary)", border: "1px solid var(--border)",
                width: "100%", maxWidth: 500, padding: 32, borderRadius: 20,
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                maxHeight: "90vh", overflowY: "auto"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: "1.8rem", color: "#00a884" }}>🔗</span>
                    <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>Conectar Instância</h2>
                </div>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 24 }}>
                    Conecte seu WhatsApp lendo o QR Code ou gerando um código de pareamento (Pairing Code).
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {/* Seção QR Code */}
                    <div style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", textAlign: "center" }}>
                        <div style={{ marginBottom: 12, color: "var(--text-secondary)" }}>
                            <QrCode size={32} />
                        </div>
                        <h3 style={{ fontSize: "1.1rem", marginBottom: 8 }}>QR Code</h3>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 16 }}>
                            Aponte a câmera do WhatsApp para conectar.
                        </p>
                        <button
                            onClick={() => handleConnect(false)}
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ padding: "10px 20px", borderRadius: 10, width: "100%" }}
                        >
                            {loading && !phone ? "Gerando..." : "Gerar QR Code"}
                        </button>
                    </div>

                    {/* Divisor */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)", fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 700 }}>
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        OU
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                    </div>

                    {/* Seção Pairing Code */}
                    <div style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <h3 style={{ fontSize: "1.1rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                            <Smartphone size={18} /> Pareamento por Número
                        </h3>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 16, textAlign: "center" }}>
                            Insira o número de WhatsApp com DDI (ex: 551199999999)
                        </p>
                        <input
                            type="text"
                            placeholder="5511999999999"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)", marginBottom: 12, outline: "none", textAlign: "center", fontSize: "1.1rem" }}
                        />
                        <button
                            onClick={() => handleConnect(true)}
                            disabled={loading || phone.length < 10}
                            className="btn btn-primary"
                            style={{ padding: "10px 20px", borderRadius: 10, width: "100%" }}
                        >
                            {loading && phone ? "Gerando..." : "Gerar Pairing Code"}
                        </button>
                    </div>
                </div>

                {/* Exibição do Resultado */}
                {result && (
                    <div style={{ marginTop: 24, padding: 20, borderRadius: 16, background: "var(--bg-primary)", border: "1px solid var(--accent)", textAlign: "center", animation: "fadeIn 0.3s ease-out" }}>
                        <h4 style={{ margin: "0 0 12px 0", color: "var(--accent)" }}>Ação Concluída</h4>
                        
                        {result.instance?.qrcode ? (
                            <div style={{ display: "flex", justifyContent: "center", background: "white", padding: 16, borderRadius: 12 }}>
                                <img src={result.instance.qrcode} alt="QR Code" style={{ width: 250, height: 250 }} />
                            </div>
                        ) : result.instance?.paircode ? (
                            <div>
                                <div style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: 4, color: "var(--text-primary)", padding: "16px 0", background: "rgba(0,168,132,0.1)", borderRadius: 12, border: "2px dashed var(--accent)" }}>
                                    {result.instance.paircode}
                                </div>
                                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 12 }}>Insira este código na notificação do WhatsApp no seu celular.</p>
                            </div>
                        ) : null}
                    </div>
                )}

                <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={onClose} className="btn btn-ghost" style={{ padding: "10px 24px", borderRadius: 12 }}>
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
