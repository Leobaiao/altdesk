import React, { useEffect, useRef, useState, useMemo } from "react";
// import io from "socket.io-client"; // Redundant
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
import { Tag as TagIcon, Book, Clock, BarChart2, CreditCard } from "lucide-react";

// Novas importações do refactoring
import { ChatProvider, useChat } from "./contexts/ChatContext";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { Reports } from "./Reports";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { ForgotPassword } from "./ForgotPassword";
import { ResetPassword } from "./ResetPassword";

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
} from "lucide-react";
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
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>🟢 AltDesk</h1>
        <p>Faça login para acessar o painel de atendimento</p>

        {error && <div className="error">{error}</div>}

        {/* 
        <div className="field">
          <label>Tenant ID</label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        </div>
        */}
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </div>
        <div className="field">
          <label>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        </div>

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
  const { conversations, setConversations, selectedConversationId, setSelectedConversationId, refreshConversations, socket } = useChat();
  const [profile, setProfile] = useState<{ Name?: string; Avatar?: string; Position?: string } | null>(null);

  // Push Notifications
  usePushNotifications(socket, selectedConversationId, conversations);

  useEffect(() => {
    api.get("/api/profile").then(res => setProfile(res.data)).catch(console.error);
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const handleStartChat = async (contact: any) => {
    if (!contact || !contact.Phone) {
      navigate("/chat");
      return;
    }
    const phone = contact.Phone.replace(/\D/g, "");

    // 1. Tentar achar localmente
    const existing = conversations.find(c => c.ExternalUserId.includes(phone));

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

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info"; action?: { label: string; onClick: () => void } } | null>(null);

  function showToast(message: string, type: "success" | "error" | "info" = "info", action?: { label: string; onClick: () => void }) {
    setToast({ message, type, action });
  }

  const currentPath = location.pathname;
  const isChat = currentPath.startsWith("/chat") || currentPath === "/";
  const isMobileDetailOpen = isChat && !!selectedConversationId;

  return (
    <div className={`app-layout ${isChat ? "is-chat" : "not-chat"} ${isMobileDetailOpen ? "mobile-detail-open" : ""}`}>
      {/* Sidebar Principal (Menu de Ícones) */}
      <div className="sidebar-main">
        <div className="profile-selection" style={{ marginBottom: 30, textAlign: "center" }} onClick={() => navigate("/settings")}>
          {profile?.Avatar ? (
            <img src={profile.Avatar} alt="Profile" className="sidebar-avatar" />
          ) : (
            <div className="sidebar-avatar-placeholder">
              {profile?.Name ? profile.Name.charAt(0).toUpperCase() : role.charAt(0)}
            </div>
          )}
        </div>
        <div className="nav-items">
          {/* Atendimento */}
          <NavIcon icon={MessageSquare} label="Conversas" active={isChat} onClick={() => navigate("/chat")} />
          <NavIcon icon={ContactsIcon} label="Contatos" active={currentPath.startsWith("/contacts")} onClick={() => navigate("/contacts")} />
          <NavIcon icon={LayoutDashboard} label="Dashboard" active={currentPath.startsWith("/dashboard")} onClick={() => navigate("/dashboard")} />

          <div style={{ height: 1, background: "var(--border)", margin: "10px 15px", opacity: 0.5 }} />

          {/* Gestão e Apoio */}
          <NavIcon icon={BookOpen} label="Respostas Rápidas" active={currentPath.startsWith("/canned")} onClick={() => navigate("/canned")} />
          <NavIcon icon={UsersIcon} label="Minha Equipe" active={currentPath.startsWith("/users")} onClick={() => navigate("/users")} />
          <NavIcon icon={Search} label="Filas de Atendimento" active={currentPath.startsWith("/queues")} onClick={() => navigate("/queues")} />
          <NavIcon icon={TagIcon} label="Tags" active={currentPath.startsWith("/tags")} onClick={() => navigate("/tags")} />
          <NavIcon icon={Book} label="Base de Conhecimento" active={currentPath.startsWith("/knowledge")} onClick={() => navigate("/knowledge")} />
          <NavIcon icon={Clock} label="Horário de Atendimento" active={currentPath.startsWith("/business-hours")} onClick={() => navigate("/business-hours")} />
          <NavIcon icon={Ticket} label="Chamados" active={currentPath.startsWith("/tickets")} onClick={() => navigate("/tickets")} />
          <NavIcon icon={BarChart2} label="Relatórios" active={currentPath.startsWith("/reports")} onClick={() => navigate("/reports")} />
          <NavIcon icon={CreditCard} label="Faturamento" active={currentPath.startsWith("/billing")} onClick={() => navigate("/billing")} />
        </div>
        <div className="footer-items">
          <NavIcon icon={SettingsIcon} label="Config" active={currentPath.startsWith("/settings")} onClick={() => navigate("/settings")} />
          <button onClick={onLogout} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.7, padding: 10, color: "var(--text-secondary)" }} title="Sair">
            <LogOut size={24} />
          </button>
        </div>
      </div>

      {/* Painel Secundário de Lista de Conversas (Disponível apenas no CHAT) */}
      {isChat && <Sidebar setView={(v) => navigate(`/${v.toLowerCase()}`)} />}

      {/* Área Principal Dinâmica (Chat window, ou outra tela de config) */}
      <div className="chat-area">
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatWindow setView={(v) => navigate(`/${v.toLowerCase()}`)} showToast={showToast} />} />
          <Route path="/contacts" element={<Contacts onBack={() => navigate("/chat")} onStartChat={handleStartChat} />} />
          <Route path="/canned" element={<CannedResponses onBack={() => navigate("/chat")} />} />
          <Route path="/dashboard" element={<DashboardView token={token} onBack={() => navigate("/chat")} />} />

          <Route path="/users" element={<Users token={token} onBack={() => navigate("/chat")} role={role || 'AGENT'} />} />

          <Route path="/settings" element={<Settings token={token} onBack={() => navigate("/chat")} role={role || 'AGENT'} />} />
          <Route path="/queues" element={<QueueSettings onBack={() => navigate("/chat")} />} />
          <Route path="/tags" element={<TagsSettings onBack={() => navigate("/chat")} />} />
          <Route path="/knowledge" element={<KnowledgeBase onBack={() => navigate("/chat")} />} />
          <Route path="/business-hours" element={<BusinessHours onBack={() => navigate("/chat")} />} />
          <Route path="/tickets" element={<Tickets token={token} onBack={() => navigate("/chat")} role={role || 'AGENT'} />} />
          <Route path="/reports" element={<Reports onBack={() => navigate("/chat")} />} />
          <Route path="/billing" element={<Billing onBack={() => navigate("/chat")} />} />

          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
    } else {
      navigate("/login");
    }
  }, [token, role, navigate]);

  function handleLogin(newToken: string, newRole: string) {
    setToken(newToken);
    setRole(newRole);
    navigate("/chat");
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
        <Route path="/login" element={<LoginScreen onLogin={handleLogin} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
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
      <MainLayout token={token} role={role || 'AGENT'} onLogout={handleLogout} />
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
