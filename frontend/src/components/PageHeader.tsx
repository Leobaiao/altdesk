import React, { useState } from "react";
import { ArrowLeft, HelpCircle, X } from "lucide-react";
import DOMPurify from "dompurify";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ElementType;
    onBack?: () => void;
    actionNode?: React.ReactNode;
    helpText?: React.ReactNode;
}

export function PageHeader({ title, subtitle, icon: Icon, onBack, actionNode, helpText }: PageHeaderProps) {
    const [showHelp, setShowHelp] = useState(false);

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 15, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="btn btn-ghost"
                        style={{ padding: 8, borderRadius: "50%" }}
                        title="Voltar"
                    >
                        <ArrowLeft size={24} />
                    </button>
                )}
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {Icon && <Icon size={24} className="text-accent" />}
                        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>{title}</h1>
                    </div>
                    {subtitle && (
                        <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {helpText && (
                    <button
                        onClick={() => setShowHelp(true)}
                        style={{ 
                            background: "rgba(0,168,132,0.1)", 
                            border: "1px solid rgba(0,168,132,0.2)", 
                            padding: "8px 12px", 
                            cursor: "pointer", 
                            display: "flex", 
                            alignItems: "center", 
                            gap: 8,
                            borderRadius: 10,
                            opacity: 0.8, 
                            transition: "all 0.2s" 
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.opacity = "1";
                            e.currentTarget.style.background = "rgba(0,168,132,0.15)";
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.opacity = "0.8";
                            e.currentTarget.style.background = "rgba(0,168,132,0.1)";
                        }}
                        title="O que esta pagina faz?"
                    >
                        <img 
                            src="/help.png" 
                            alt="?" 
                            style={{ width: 18, height: 18 }} 
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const svg = e.currentTarget.parentElement?.querySelector('svg');
                                if (svg) (svg as any).style.display = 'block';
                            }}
                        />
                        <HelpCircle size={18} className="text-accent" style={{ display: 'none' }} />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)" }}>AJUDA</span>
                    </button>
                )}
                {actionNode && (
                    <div>
                        {actionNode}
                    </div>
                )}
            </div>

            {/* Help Overlay - Simple & Premium */}
            {showHelp && (
                <div style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)",
                    zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 20
                }} onClick={() => setShowHelp(false)}>
                    <div style={{
                        background: "var(--bg-secondary)", 
                        borderRadius: 24, 
                        border: "1px solid var(--border)",
                        maxWidth: 550, 
                        width: "100%", 
                        padding: 40, 
                        position: "relative",
                        animation: "fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)", 
                        boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
                        overflow: "hidden"
                    }} onClick={e => e.stopPropagation()}>
                        {/* Decorative element */}
                        <div style={{ position: "absolute", top: -50, right: -50, width: 150, height: 150, background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)", opacity: 0.1 }} />
                        
                        <button onClick={() => setShowHelp(false)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.05)", border: "none", color: "var(--text-secondary)", cursor: "pointer", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={20} />
                        </button>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 25 }}>
                            <div style={{ padding: 12, background: "rgba(0,168,132,0.15)", borderRadius: 16, color: "var(--accent)" }}>
                                <HelpCircle size={28} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Guia do Usuário</h2>
                                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>{title}</p>
                            </div>
                        </div>
                        
                        <div style={{ color: "var(--text-primary)", fontSize: "1.05rem", lineHeight: 1.7, fontWeight: 400 }}>
                            {helpText}
                        </div>
                        
                        <button onClick={() => setShowHelp(false)} className="btn btn-primary" style={{ marginTop: 35, width: "100%", height: 50, borderRadius: 15, fontSize: "1rem", fontWeight: 700 }}>
                            Entendi perfeitamente
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
