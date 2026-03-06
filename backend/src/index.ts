import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import { errorHandler } from "./middleware/errorHandler.js";
import { GtiAdapter } from "./adapters/gti.js";
import { OfficialAdapter } from "./adapters/official.js";
import { WebChatAdapter } from "./adapters/webchat.js";

// Import Routers
import authRouter from "./routes/auth.js";
import profileRouter from "./routes/profile.js";
import adminRouter from "./routes/admin.js";
import agentsRouter from "./routes/agents.js";
import usersRouter from "./routes/users.js";
import chatRouter from "./routes/chat.js";
import webhooksRouter from "./routes/webhooks.js";
import settingsRouter from "./routes/settings.js";
import queuesRouter from "./routes/queues.js";
import contactsRouter from "./routes/contacts.js";
import templatesRouter from "./routes/templates.js";
import cannedResponsesRouter from "./routes/cannedResponses.js";
import dashboardRouter from "./routes/dashboard.js";
import rolesRouter from "./routes/roles.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const adapters = {
  gti: new GtiAdapter(),
  official: new OfficialAdapter(),
  whatsapp: new OfficialAdapter(), // Map classic whatsapp to official
  webchat: new WebChatAdapter()
} as const;

// Inject dependencies into Express so routers can pick them up without circular imports
app.set("io", io);
app.set("adapters", adapters);

// --- Socket.IO rooms ---
io.on("connection", (socket) => {
  socket.on("conversation:join", (conversationId: string) => socket.join(conversationId));
  socket.on("conversation:leave", (conversationId: string) => socket.leave(conversationId));
  socket.on("tenant:join", (tenantId: string) => socket.join(`tenant:${tenantId}`));
  socket.on("tenant:leave", (tenantId: string) => socket.leave(`tenant:${tenantId}`));
});

// --- API ROUTES ---
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/admin", adminRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/conversations", chatRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/queues", queuesRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/canned-responses", cannedResponsesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/roles", rolesRouter);

// Webhooks
// Ex: POST /api/webhooks/whatsapp/:provider/:connectorId/*
// Ex: POST /api/external/webchat/message
app.use("/api", webhooksRouter);

// Internal Demo Hook mappings (previously inside chat routes but better kept attached if using global io)
app.post("/api/demo/conversations/:id/messages", async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const { text } = req.body;
    io.to(conversationId).emit("message:new", {
      conversationId,
      senderExternalId: "demo",
      text,
      direction: "INTERNAL"
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
