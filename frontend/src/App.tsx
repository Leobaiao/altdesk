import React, { useEffect, useRef, useState, useMemo } from "react";

import { CannedResponses } from "./CannedResponses";
import { QueueSettings } from "./QueueSettings";
import { Contacts } from "./Contacts";
import { Toast } from "./components/Toast";
import { EmojiPicker } from "./components/EmojiPicker";
import { TemplateModal } from "./components/TemplateModal";
import { AudioPlayer } from "./components/AudioPlayer";
import { Settings } from "./Settings";
import { Dashboard as DashboardView } from "./Dashboard";
import { Users } from "./Users";
import { Tickets } from "./Tickets";
import { TagsSettings } from "./TagsSettings";
import { KnowledgeBase } from "./KnowledgeBase";
import { BusinessHours } from "./BusinessHours";
import { Billing } from "./Billing";
import { AuditLogs } from "./AuditLogs";
import { Tag as TagIcon, Book, Clock, BarChart2, CreditCard } from "lucide-react";

// Novas importações do refactoring
import { ChatProvider, useChat } from "./contexts/ChatContext";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { Reports } from "./Reports";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { ForgotPassword } from "./ForgotPassword";
import { ResetPassword } from "./ResetPassword";
import { Onboarding } from "./Onboarding";
import LogoHorizontal from "./assets/logo/logo-horizontal.png";
import logo from "./assets/logo/logo.png";
import { WelcomeScreen } from "./WelcomeScreen";
import { ThemeToggle } from "./components/ThemeToggle";

import {
  LayoutDashboard,
  MessageSquare,
  Ticket,
  BookOpen,
  Users as UsersIcon,
  Contact as ContactsIcon,
  Settings as SettingsIcon,
  Bot,
  LogOut,
  Search,
  HelpCircle,
} from "lucide-react";
import { HelpProvider, useHelp } from "./contexts/HelpContext";
import { HelpDrawer } from "./components/HelpDrawer";
import { HelpAdmin } from "./HelpAdmin";
function NavIcon({ icon, label, active, onClick }: any) {
  const IconComponent = icon;
  return (
    <div
      onClick={onClick}
      title={label}
      className={`nav-icon-wrapper ${active ? "active" : ""}`}
    >
      <IconComponent size={24} strokeWidth={2} />
    </div>
  );
}

function TabButton({ label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: 12,
        background: "transparent",
        border: "none",
        color: active ? "#00a884" : "#8696a0",
        cursor: "pointer",
        borderBottom: active ? "2px solid #00a884" : "2px solid transparent",
        fontWeight: 500
      }}
    >
      {label}
    </button>
  );
}

import { api } from "./lib/api";
import { parseJwt } from "./lib/auth";
// const socket = io(import.meta.env.VITE_API_URL || undefined); // Redundant

import type { Conversation, Message, CannedResponse } from "../../shared/types";

import { PasswordInput } from "./components/PasswordInput";

// ─── Login ────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (token: string, role: string) => void }) {
  // const [tenantId, setTenantId] = useState("42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D"); // Removed
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Simplified Login: No TenantId required
      const res = await api.post("/api/auth/login", { email, password });
      const data = res.data;
      localStorage.setItem("token", data.token);
      onLogin(data.token, data.role);
    } catch (err: any) {
      if (!err.response) {
        setError("Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente em instantes.");
      } else if (err.response.status >= 500) {
        setError("O servidor está temporariamente instável (Erro " + err.response.status + "). Por favor, aguarde um momento e tente novamente.");
      } else {
        setError(err.response?.data?.error || "Credenciais inválidas ou erro inesperado.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <ThemeToggle style={{ position: "absolute", top: 20, right: 30 }} />
      <form className="login-card" onSubmit={handleSubmit}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src={LogoHorizontal} alt="AltDesk Logo" style={{ maxWidth: "200px", height: "auto" }} />
        </div>
        <p>Faça login para acessar o painel de atendimento</p>

        {error && <div className="error">{error}</div>}

        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </div>
        
        <PasswordInput
          label="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
        />

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <a href="/forgot-password" style={{ color: "var(--text-secondary)", fontSize: "14px", textDecoration: "none" }}>
            Esqueceu sua senha?
          </a>
        </div>
      </form>
    </div>
  );
}

import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

// ─── Main Layout ────────────────────────────────────
function MainLayout({ token, role, onLogout }: { token: string; role: string; onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const decoded = useMemo(() => parseJwt(token), [token]);
  const { openHelp, pageContextKey } = useHelp();

  const getPageTitle = (path: string) => {
    if (path.startsWith("/chat")) return "Central de Mensagens";
    if (path.startsWith("/dashboard")) return "Dashboard Executivo";
    if (path.startsWith("/tickets")) return "Gestão de Chamados";
    if (path.startsWith("/contacts")) return "Lista de Contatos";
    if (path.startsWith("/users")) return "Equipe e Colaboradores";
    if (path.startsWith("/reports")) return "Relatórios Analíticos";
    if (path.startsWith("/settings")) return "Configurações do Sistema";
    if (path.startsWith("/billing")) return "Faturamento e Assinatura";
    if (path.startsWith("/knowledge")) return "Base de Conhecimento";
    return "AltDesk";
  };
  const { conversations, setConversations, selectedConversationId, setSelectedConversationId, refreshConversations, socket } = useChat();
  const [profile, setProfile] = useState<{ Name?: string; Avatar?: string; Position?: string; TenantName?: string; PermissionsJson?: string } | null>(null);
  const [livePermissions, setLivePermissions] = useState<any>(decoded?.permissions || {});

  // Push Notifications
  usePushNotifications(socket, selectedConversationId, conversations);

  useEffect(() => {
    api.get("/api/profile").then(res => {
        setProfile(res.data);
        if (res.data.PermissionsJson) {
            try {
                setLivePermissions(JSON.parse(res.data.PermissionsJson));
            } catch (e) {}
        }
    }).catch(console.error);
  }, []);

  const handleStartChat = async (contact: any) => {
    if (!contact || !contact.Phone) {
      navigate("/chat");
      return;
    }
    const phone = contact.Phone.replace(/\D/g, "");

    // 1. Tentar achar localmente (com segurança contra valores nulos)
    const existing = conversations.find(c => c.ExternalUserId?.includes(phone));

    if (existing) {
      setSelectedConversationId(existing.ConversationId);
      navigate("/chat");
    } else {
      try {
        // 2. Se não existir, pedir para o backend criar/buscar
        const res = await api.post("/api/conversations", {
          phone,
          name: contact.Name
        });

        if (res.data.conversationId) {
          // Atualiza localmente para bypassar o delay de loading
          const decoded = parseJwt(token);
          setConversations(prev => {
              if (prev.some(c => c.ConversationId === res.data.conversationId)) return prev;
              return [{
                  ConversationId: res.data.conversationId,
                  ExternalUserId: phone,
                  Title: contact.Name || phone,
                  Status: "OPEN",
                  AssignedUserId: decoded?.userId || null,
                  UnreadCount: 0,
                  LastMessageAt: new Date().toISOString()
              } as any, ...prev];
          });
          
          refreshConversations();
          setSelectedConversationId(res.data.conversationId);
        }
        navigate("/chat");
      } catch (err: any) {
        showToast("Erro ao iniciar conversa: " + (err.response?.data?.error || err.message), "error");
      }
    }
  };

  const { showToast } = useChat();

  const currentPath = location.pathname;
  const isChat = currentPath.startsWith("/chat") || currentPath === "/";
  const isTickets = currentPath.startsWith("/tickets");
  const isMobileDetailOpen = isChat && !!selectedConversationId;

  const GlobalHeader = () => (
    <div className="global-header" style={{ 
      padding: "0 24px", 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center", 
      borderBottom: "1px solid var(--border)", 
      background: "var(--bg-primary)",
      height: 64,
      zIndex: 10
    }}>
        {/* Esquerda: Título da Página */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
                {getPageTitle(location.pathname)}
            </h1>
        </div>

        {/* Centro: Espaço para busca ou menus centrais futuramente */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        </div>

        {/* Direita: Perfil do Usuário + Botão de Ajuda Contextual */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {(isChat || isTickets) && (
                <button
                    onClick={(e) => {
                        if (e.nativeEvent && !e.nativeEvent.isTrusted) {
                            console.warn("[App] Blocked automated click from script/extension");
                            return;
                        }
                        console.log("[App] Global Header Help click - pageContextKey:", pageContextKey);
                        if (isChat) {
                            openHelp("chat.index");
                        } else if (isTickets) {
                            openHelp(pageContextKey || "tickets.index");
                        }
                    }}
                    style={{
                        background: "rgba(0,168,132,0.1)",
                        border: "1px solid rgba(0,168,132,0.2)",
                        padding: "6px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 10,
                        transition: "all 0.2s"
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(0,168,132,0.15)";
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(0,168,132,0.1)";
                    }}
                    title="Ajuda desta tela"
                >
                    <HelpCircle size={16} className="text-accent" />
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)" }} className="hide-mobile">AJUDA</span>
                </button>
            )}

            <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={() => navigate("/settings")}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.2 }}>{profile?.Name || "Usuário"}</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600, opacity: 0.9 }}>{profile?.TenantName || "Empresa"}</span>
                </div>

               {profile?.Avatar ? (
                   <img src={profile.Avatar} alt="Profile" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", border: "2px solid var(--border)" }} />
               ) : (
                   <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1rem" }}>
                       {profile?.Name ? profile.Name.charAt(0).toUpperCase() : role.charAt(0)}
                   </div>
               )}
            </div>
        </div>
    </div>
  );

  return (
    <div className={`app-layout ${isChat ? "is-chat" : "not-chat"} ${isMobileDetailOpen ? "mobile-detail-open" : ""}`}>
      {/* Sidebar Principal (Menu de Ícones) */}
      <div className="sidebar-main">
        <div className="brand" onClick={() => navigate("/chat")} style={{ cursor: "pointer", marginBottom: 30, display: "flex", justifyContent: "center" }}>
          <img src={logo} alt="Brand" style={{ width: 44, height: 44, borderRadius: 12 }} />
        </div>
        
        <div className="nav-items">
          {role !== 'END_USER' && livePermissions?.dashboard !== false && (
            <NavIcon icon={LayoutDashboard} label="Dashboard" active={currentPath.startsWith("/dashboard")} onClick={() => navigate("/dashboard")} />
          )}

          {(livePermissions?.chat !== false || role === 'END_USER') && (
            <NavIcon icon={MessageSquare} label="Conversas" active={isChat} onClick={() => navigate("/chat")} />
          )}

          {livePermissions?.tickets !== false && (
            <NavIcon icon={Ticket} label={role === 'END_USER' ? "Meus Chamados" : "Gestão de Chamados"} active={currentPath.startsWith("/tickets")} onClick={() => navigate("/tickets")} />
          )}
          
          <div style={{ height: 1, background: "var(--border)", margin: "10px 15px", opacity: 0.5 }} />
          
          {role !== 'END_USER' && livePermissions?.contacts !== false && (
            <NavIcon icon={ContactsIcon} label="Contatos" active={currentPath.startsWith("/contacts")} onClick={() => navigate("/contacts")} />
          )}
          {role !== 'END_USER' && livePermissions?.users !== false && (
            <NavIcon icon={UsersIcon} label="Colaboradores" active={currentPath.startsWith("/users")} onClick={() => navigate("/users")} />
          )}
          
          {role !== 'END_USER' && livePermissions?.reports !== false && (
            <>
              <div style={{ height: 1, background: "var(--border)", margin: "10px 15px", opacity: 0.5 }} />
              <NavIcon icon={BarChart2} label="Relatórios" active={currentPath.startsWith("/reports")} onClick={() => navigate("/reports")} />
            </>
          )}
        </div>
        <div className="footer-items">
          {role !== 'END_USER' && (role === 'SUPERADMIN' || role === 'ADMIN' || role === 'AGENT' || livePermissions?.settings !== false) && (
            <NavIcon icon={SettingsIcon} label="Config" active={currentPath.startsWith("/settings") || currentPath.startsWith("/business-hours") || currentPath.startsWith("/canned") || currentPath.startsWith("/knowledge") || currentPath.startsWith("/billing")} onClick={() => navigate("/settings")} />
          )}
          <button 
            onClick={async () => {
              try { await api.post("/api/auth/logout"); } catch (e) {}
              onLogout();
            }} 
            style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.7, padding: 10, color: "var(--text-secondary)" }} 
            title="Sair"
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {GlobalHeader()}
        <div style={{ flex: 1, display: "flex", minWidth: 0, overflow: "hidden" }}>
          {/* Painel Secundário de Lista de Conversas (Disponível apenas no CHAT) */}
          {isChat && <Sidebar setView={(v) => navigate(`/${v.toLowerCase()}`)} />}

          {/* Área Principal Dinâmica (Chat window, ou outra tela de config) */}
          <div className="chat-area" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
              <Routes>
                <Route path="/" element={<Navigate to={role === 'END_USER' ? "/tickets" : "/chat"} replace />} />
                <Route path="/chat" element={<ChatWindow setView={(v: any) => {
                  if (typeof v === 'string') navigate(`/${v.toLowerCase()}`);
                  else if (v?.type === 'TICKET') navigate('/tickets', { state: { ticketId: v.id } });
                }} />} />
                <Route path="/contacts" element={<Contacts onBack={() => navigate("/chat")} onStartChat={handleStartChat} />} />
                <Route path="/canned" element={<CannedResponses onBack={() => navigate("/settings")} />} />
                <Route path="/dashboard" element={<DashboardView token={token} onBack={() => navigate("/chat")} />} />

                <Route path="/users" element={<Users token={token} onBack={() => navigate("/chat")} role={role || 'AGENT'} />} />

                <Route path="/settings" element={
                  (role === 'SUPERADMIN' || role === 'ADMIN' || role === 'AGENT' || role === 'END_USER' || livePermissions?.settings !== false) 
                    ? <Settings token={token} onBack={() => navigate("/chat")} role={role || 'AGENT'} livePermissions={livePermissions} />
                    : <Navigate to="/chat" replace />
                } />
                <Route path="/queues" element={<QueueSettings onBack={() => navigate("/settings")} />} />
                <Route path="/tags" element={<TagsSettings onBack={() => navigate("/settings")} />} />
                <Route path="/knowledge" element={<KnowledgeBase onBack={() => navigate("/settings")} />} />
                <Route path="/business-hours" element={<BusinessHours onBack={() => navigate("/settings")} />} />
                <Route path="/help-admin" element={<HelpAdmin onBack={() => navigate("/settings")} />} />
                <Route path="/tickets" element={<Tickets token={token} onBack={() => navigate("/chat")} role={role || 'AGENT'} />} />
                <Route path="/reports" element={<Reports onBack={() => navigate("/chat")} />} />
                <Route path="/billing" element={<Billing onBack={() => navigate("/settings")} />} />
                <Route path="/audit" element={<AuditLogs onBack={() => navigate("/settings")} />} />

                <Route path="*" element={<Navigate to={role === 'END_USER' ? "/dashboard" : "/chat"} replace />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
      <HelpDrawer />
    </div>
  );
}


// ─── App Root ─────────────────────────────────────
function AppContent() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();

  // Validate token on load
  useEffect(() => {
    if (token) {
      const decoded = parseJwt(token);
      if (!decoded || !decoded.tenantId) {
        console.error("Invalid token, logging out");
        localStorage.removeItem("token");
        setToken(null);
        setRole(null);
        navigate("/login");
      } else if (!role && decoded.role) {
        setRole(decoded.role);
      }
    }
  }, [token, role, navigate]);

  function handleLogin(newToken: string, newRole: string) {
    setToken(newToken);
    setRole(newRole);
    if (newRole === 'END_USER') {
      navigate("/tickets");
    } else {
      navigate("/chat");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken(null);
    setRole(null);
    navigate("/login");
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/login" element={<LoginScreen onLogin={handleLogin} />} />
        <Route path="/onboarding" element={<Onboarding onLogin={handleLogin} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Verify again before rendering Dashboard to prevent crash
  const decoded = parseJwt(token);
  if (!decoded) {
    handleLogout();
    return null;
  }

  return (
    <ChatProvider token={token} onLogout={handleLogout}>
      <HelpProvider>
        <MainLayout token={token} role={role || 'AGENT'} onLogout={handleLogout} />
      </HelpProvider>
    </ChatProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
