import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { verifyToken } from "./auth.js";

import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { GtiAdapter } from "./adapters/gti.js";
import { OfficialAdapter } from "./adapters/official.js";
import { WebChatAdapter } from "./adapters/webchat.js";
import { logger } from "./lib/logger.js";

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
import tagsRouter from "./routes/tags.js";
import knowledgeRouter from "./routes/knowledge.js";
import businessHoursRouter from "./routes/business-hours.js";
import publicRouter from "./routes/public.js";
import { startSlaWorker } from "./services/slaService.js";

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000"];

const app = express();
app.set("trust proxy", 1); // Behind Nginx reverse proxy
app.use(apiLimiter);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({
  limit: "5mb",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.static("public"));

// HTTP Access Log (antes das rotas para capturar todos os requests)
app.use(requestLogger);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowedOrigins } });

const adapters = {
  gti: new GtiAdapter(),
  official: new OfficialAdapter(),
  whatsapp: new OfficialAdapter(), // Map classic whatsapp to official
  webchat: new WebChatAdapter()
} as const;

// Inject dependencies into Express so routers can pick them up without circular imports
app.set("io", io);
app.set("adapters", adapters);

// --- Socket.IO Authentication Middleware ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    logger.warn({ socketId: socket.id }, "[Socket] Auth failed: no token");
    return next(new Error("Authentication error: No token provided"));
  }
  try {
    const user = verifyToken(token);
    socket.data.user = user;
    next();
  } catch (err) {
    logger.warn({ socketId: socket.id }, "[Socket] Auth failed: invalid token");
    next(new Error("Authentication error: Invalid token"));
  }
});

// --- Socket.IO rooms ---
io.on("connection", (socket) => {
  const user = socket.data.user;
  logger.info(
    { userId: user.userId, tenantId: user.tenantId, socketId: socket.id },
    "[Socket] User connected"
  );

  socket.on("disconnect", (reason) => {
    logger.info(
      { userId: user.userId, socketId: socket.id, reason },
      "[Socket] User disconnected"
    );
  });

  socket.on("conversation:join", (conversationId: string) => {
    socket.join(conversationId);
  });

  socket.on("conversation:leave", (conversationId: string) => socket.leave(conversationId));

  socket.on("tenant:join", (tenantId: string) => {
    // ENFORCE: user can only join their own tenant room
    if (tenantId === user.tenantId) {
      socket.join(`tenant:${tenantId}`);
    } else {
      logger.warn(
        { userId: user.userId, requestedTenantId: tenantId, ownTenantId: user.tenantId },
        "[Socket] Unauthorized tenant room join attempt"
      );
    }
  });

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
app.use("/api/tags", tagsRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/business-hours", businessHoursRouter);

// Webhooks
app.use("/api", webhooksRouter);
app.use("/api/public", publicRouter);

// Internal Demo Hook
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

// Global Error Handler (deve ser o último middleware)
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info({ port: PORT }, `AltDesk API started`);
  startSlaWorker(); // Defaults to 60s
});
