import React, { useEffect, useMemo, useState } from "react";
import io from "socket.io-client";

type Conversation = { id: string; title: string; last: string; kind: "GROUP"|"TICKET"|"DIRECT" };
type Message = { id: string; sender: string; text: string; at: string; direction: "IN"|"OUT"|"INTERNAL" };

const socket = io("http://localhost:3001");

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: "demo-1", title: "WhatsApp • 5511999999999", last: "Aguardando mensagem…", kind: "DIRECT" },
    { id: "demo-2", title: "Grupo • Operação", last: "Ok.", kind: "GROUP" }
  ]);
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    socket.emit("conversation:join", activeId);

    const onNew = (m: any) => {
      if (m.conversationId !== activeId) return;
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender: m.senderExternalId ?? "system",
        text: m.text,
        at: new Date().toISOString(),
        direction: m.direction ?? "IN"
      }]);
    };

    socket.on("message:new", onNew);
    return () => {
      socket.emit("conversation:leave", activeId);
      socket.off("message:new", onNew);
    };
  }, [activeId]);

  const activeConv = useMemo(() => conversations.find(c => c.id === activeId)!, [conversations, activeId]);

  async function sendDemo() {
    if (!text.trim()) return;
    await fetch(`http://localhost:3001/api/demo/conversations/${encodeURIComponent(activeId)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
    setText("");
  }

  return (
    <div style={{ height: "100vh", display: "flex", background: "#0b141a", color: "#e9edef", fontFamily: "Inter, system-ui" }}>
      {/* Sidebar esquerda */}
      <div style={{ width: 360, borderRight: "1px solid #24333b", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 14, borderBottom: "1px solid #24333b" }}>
          <div style={{ fontSize: 14, opacity: 0.85 }}>OmniDesk</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>WhatsApp • Webchat • Tickets</div>
        </div>

        <div style={{ padding: 10 }}>
          <input placeholder="Buscar conversa" style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #24333b", background: "#111b21", color: "#e9edef" }} />
        </div>

        <div style={{ overflow: "auto", flex: 1 }}>
          {conversations.map(c => (
            <div
              key={c.id}
              onClick={() => setActiveId(c.id)}
              style={{
                padding: 12,
                cursor: "pointer",
                background: c.id === activeId ? "#1f2c33" : "transparent",
                borderBottom: "1px solid #18262e"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14 }}>{c.title}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{c.kind}</div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{c.last}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Centro */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #24333b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14 }}>{activeConv.title}</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Status: OPEN • SLA: 2h • Sugestões: ON</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btn}>⚡ Respostas rápidas</button>
            <button style={btn}>Escalar</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16, background: "#0b141a" }}>
          {messages.map(m => (
            <div key={m.id} style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
              <div style={{ maxWidth: "70%", background: "#1f2c33", padding: "10px 12px", borderRadius: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{m.sender}</div>
                <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid #24333b", display: "flex", gap: 10, background: "#111b21" }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Digite uma mensagem (demo)"
            style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #24333b", background: "#0b141a", color: "#e9edef" }}
            onKeyDown={(e) => e.key === "Enter" ? sendDemo() : null}
          />
          <button style={btn} onClick={sendDemo}>Enviar</button>
        </div>
      </div>

      {/* Sidebar direita */}
      <div style={{ width: 360, borderLeft: "1px solid #24333b", padding: 14 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>Ticket / Automação</div>
        <div style={card}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Sugestões</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
            (MVP) As sugestões virão do backend via API/WS e serão aplicáveis com 1 clique.
          </div>
        </div>
        <div style={{ height: 10 }} />
        <div style={card}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Ações</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button style={btn}>Transferir</button>
            <button style={btn}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#1f2c33",
  color: "#e9edef",
  border: "1px solid #24333b",
  padding: "10px 12px",
  borderRadius: 10,
  cursor: "pointer"
};

const card: React.CSSProperties = {
  background: "#111b21",
  border: "1px solid #24333b",
  borderRadius: 12,
  padding: 12
};
