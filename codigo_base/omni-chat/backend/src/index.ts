import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { z } from "zod";

import { getPool } from "./db.js";
import { authMw, requireRole } from "./mw.js";
import { signToken, verifyPassword, assertAgentSeatAvailable, assertTenantActive } from "./auth.js";
import { Orchestrator, TriageBot } from "./agents.js";

import { GtiAdapter } from "./adapters/gti.js";
import { OfficialAdapter } from "./adapters/official.js";
import { resolveConversationForInbound, saveInboundMessage, saveOutboundMessage } from "./services/conversation.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const orch = new Orchestrator([new TriageBot()]);

const adapters = {
  gti: new GtiAdapter(),
  official: new OfficialAdapter()
} as const;

// Helper: load connector + channel + tenant
async function loadConnector(connectorId: string) {
  const pool = await getPool();
  const r = await pool.request()
    .input("connectorId", connectorId)
    .query(`
      SELECT cc.ConnectorId, cc.Provider, cc.ConfigJson, cc.WebhookSecret, ch.ChannelId, ch.TenantId
      FROM omni.ChannelConnector cc
      JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
      WHERE cc.ConnectorId = @connectorId AND cc.IsActive=1 AND ch.IsActive=1
    `);
  if (r.recordset.length === 0) throw new Error("Connector not found/active");
  return r.recordset[0];
}

// --- LOGIN (exige tenantId) ---
app.post("/api/auth/login", async (req, res) => {
  const body = z.object({
    tenantId: z.string().uuid(),
    email: z.string().email(),
    password: z.string().min(6)
  }).parse(req.body);

  const pool = await getPool();
  const r = await pool.request()
    .input("tenantId", body.tenantId)
    .input("email", body.email)
    .query(`
      SELECT TOP 1 UserId, TenantId, Role, PasswordHash, IsActive
      FROM omni.[User]
      WHERE TenantId=@tenantId AND Email=@email
    `);

  if (r.recordset.length === 0) return res.status(401).json({ error: "Credenciais inválidas" });
  const u = r.recordset[0];
  if (!u.IsActive) return res.status(403).json({ error: "Usuário inativo" });

  await assertTenantActive(u.TenantId);

  const ok = await verifyPassword(body.password, Buffer.from(u.PasswordHash));
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

  const token = signToken({ userId: u.UserId, tenantId: u.TenantId, role: u.Role });
  return res.json({ token });
});

// --- Criar agente (limite por assinatura) ---
app.post("/api/agents", authMw, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { tenantId: string };
  const body = z.object({
    kind: z.enum(["HUMAN", "BOT"]),
    name: z.string().min(2),
    userId: z.string().uuid().nullable().optional()
  }).parse(req.body);

  await assertAgentSeatAvailable(u.tenantId);

  const pool = await getPool();
  const r = await pool.request()
    .input("tenantId", u.tenantId)
    .input("kind", body.kind)
    .input("name", body.name)
    .input("userId", body.userId ?? null)
    .query(`
      INSERT INTO omni.Agent (TenantId, Kind, Name, UserId)
      OUTPUT inserted.AgentId
      VALUES (@tenantId, @kind, @name, @userId)
    `);

  res.json({ agentId: r.recordset[0].AgentId });
});

// --- Webhook WhatsApp GTI / Official ---
app.post("/api/webhooks/whatsapp/:provider/:connectorId", async (req, res) => {
  try {
    const provider = String(req.params.provider).toLowerCase();
    const connectorId = req.params.connectorId;

    const connector = await loadConnector(connectorId);

    const adapter = (adapters as any)[provider];
    if (!adapter) return res.status(404).send("Unknown provider");

    const inbound = adapter.parseInbound(req.body, connector);
    if (!inbound) return res.status(200).send("ignored");

    const conversationId = await resolveConversationForInbound(inbound, connector.ConnectorId, connector.ChannelId);
    await saveInboundMessage(inbound, conversationId);

    io.to(conversationId).emit("message:new", {
      conversationId,
      senderExternalId: inbound.externalUserId,
      text: inbound.text ?? "[media]",
      direction: "IN"
    });

    // Orquestra: no MVP, gera sugestão (não auto-reply por padrão)
    const decisions = await orch.run("TriageBot", inbound.text ?? "[media]", {
      tenantId: inbound.tenantId,
      conversationId,
      externalSenderId: inbound.externalUserId
    });

    // TODO: gravar AgentSuggestion no DB (fase 1.1)
    // TODO: habilitar auto-reply apenas para regras neutras

    return res.status(200).json({ ok: true, conversationId, decisions });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "error" });
  }
});

// --- Socket.IO rooms ---
io.on("connection", (socket) => {
  socket.on("conversation:join", (conversationId: string) => socket.join(conversationId));
  socket.on("conversation:leave", (conversationId: string) => socket.leave(conversationId));
});

// Demo endpoint para simular mensagem interna (sem WhatsApp)
app.post("/api/demo/conversations/:id/messages", async (req, res) => {
  const conversationId = req.params.id;
  const body = z.object({ text: z.string().min(1) }).parse(req.body);

  io.to(conversationId).emit("message:new", {
    conversationId,
    senderExternalId: "demo",
    text: body.text,
    direction: "INTERNAL"
  });
  return res.json({ ok: true });
});

server.listen(process.env.PORT ?? 3001, () => {
  console.log("API on", process.env.PORT ?? 3001);
});
