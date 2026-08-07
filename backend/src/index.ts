import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { verifyToken } from "./auth.js";

import { getPool } from "./db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { globalAuditLogger } from "./middleware/auditLogger.js";
import { adapters } from "./adapters/index.js";
import { logger } from "./lib/logger.js";

// Import Routers
import authRouter from "./routes/auth.js";
import profileRouter from "./routes/profile.js";
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
import auditRouter from "./routes/auditLog.js";
import { startSlaWorker } from "./services/slaService.js";
import reportsRouter from "./routes/reports.js";
import billingRouter from "./modules/billing/billing.controller.js";
import onboardingRouter from "./routes/onboarding.js";
import emailChannelsRouter from "./routes/emailChannels.js";
import { startEmailWorker, setIoInstance } from "./services/emailWorker.js";
import helpRouter from "./routes/help.js";
import ticketsRouter from "./routes/tickets.js";
import uploadRouter from "./routes/upload.js";
import internalChatRouter from "./routes/internalChat.js";
import widgetRouter from "./routes/widget.js";
import widgetPublicRouter from "./routes/widgetPublic.js";

const dynamicCorsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin) return callback(null, true);
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
  if (/^https?:\/\/(.*\.)?altdesk\.com\.br$/.test(origin)) return callback(null, true);
  
  const envOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : [];
  if (envOrigins.includes(origin)) return callback(null, true);
  
  callback(new Error('Not allowed by CORS'));
};

const app = express();
app.disable("x-powered-by"); // Minimized info exposure
app.set("trust proxy", 1); // Behind Nginx reverse proxy
app.use(apiLimiter);
app.use(cors({ origin: dynamicCorsOrigin, credentials: true }));
app.use(express.json({
  limit: "5mb",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.static("public"));

// HTTP Access Log (antes das rotas para capturar todos os requests)
app.use(requestLogger);

// Endpoint de Health Check e Diagnóstico
app.get("/api/health", async (req, res) => {
    try {
        const pool = await getPool();
        const r = await pool.request().query("SELECT 1 as result");
        if (r.recordset[0].result === 1) {
            res.status(200).json({ status: "ok", message: "Database connected" });
        } else {
            res.status(500).json({ status: "error", message: "Unexpected database query result" });
        }
    } catch (error: any) {
        res.status(500).json({ 
            status: "error", 
            message: "Database connection failed", 
            details: error.message,
            dbHost: process.env.DB_HOST,
            dbName: process.env.DB_NAME
        });
    }
});

app.use(globalAuditLogger);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: dynamicCorsOrigin, credentials: true } });

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

  socket.on("conversation:join", async (conversationId: string) => {
    // ENFORCE: user can only join conversations that belong to their tenant
    try {
      const pool = await getPool();
      const check = await pool.request()
        .input("conversationId", conversationId)
        .input("tenantId", user.tenantId)
        .query("SELECT 1 FROM altdesk.Conversation WHERE ConversationId = @conversationId AND TenantId = @tenantId");
      if (check.recordset.length > 0) {
        socket.join(conversationId);
      } else {
        logger.warn(
          { userId: user.userId, conversationId, tenantId: user.tenantId },
          "[Socket] Unauthorized conversation join attempt"
        );
      }
    } catch (err) {
      logger.error({ err, conversationId }, "[Socket] Error verifying conversation access");
    }
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

  // Widget-specific: allow agents to join widget conversation rooms
  socket.on("widget:conversation:join", (conversationId: string) => {
    socket.join(`widget:${conversationId}`);
  });

  // Typing indicator: broadcast to all others in conversation room
  socket.on("typing:start", ({ conversationId }: { conversationId: string }) => {
    const userName = (user as any).displayName || (user as any).email || "Agente";
    socket.to(conversationId).emit("typing:start", { conversationId, userName });
  });

  socket.on("typing:stop", ({ conversationId }: { conversationId: string }) => {
    socket.to(conversationId).emit("typing:stop", { conversationId });
  });
});

// --- API ROUTES ---
app.use("/api/webhooks", webhooksRouter);
app.use("/api/auth", authRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/profile", profileRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/conversations/internal", internalChatRouter);
app.use("/api/conversations", chatRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/queues", queuesRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/canned-responses", cannedResponsesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/help", helpRouter);
app.use("/api/business-hours", businessHoursRouter);
app.use("/api/audit", auditRouter);
app.use("/api/reports", reportsRouter);

app.use("/api/public", publicRouter);
app.use("/api/public/widget", widgetPublicRouter);
app.use("/api/widget", widgetRouter);
app.use("/api/upload", uploadRouter);

// Email Channels (gestão de canais de email)
app.use("/api/email-channels", emailChannelsRouter);

// Billing (inclui webhook público + rotas autenticadas)
app.use("/api/billing", billingRouter);



// Global Error Handler (deve ser o último middleware)
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT }, `AltDesk API started`);
  startSlaWorker(); // Defaults to 60s

  // Iniciar o worker de email polling (60s interval)
  setIoInstance(io);
  startEmailWorker(60_000);

  // --- Socket.IO /widget namespace for visitor connections (no JWT required) ---
  const widgetNs = io.of("/widget");
  app.set("widgetNs", widgetNs);
  widgetNs.on("connection", (socket) => {
    const { tenantId, visitorId } = socket.handshake.auth || {};
    if (!tenantId || !visitorId) {
      logger.warn({ socketId: socket.id }, "[Widget Socket] Missing tenantId or visitorId");
      socket.disconnect(true);
      return;
    }

    const roomName = `widget:${tenantId}:${visitorId}`;
    socket.join(roomName);
    logger.info({ tenantId, visitorId, socketId: socket.id }, "[Widget Socket] Visitor connected");

    socket.on("disconnect", () => {
      logger.info({ tenantId, visitorId, socketId: socket.id }, "[Widget Socket] Visitor disconnected");
    });

    // Visitor sends a message via socket (alternative to HTTP POST)
    socket.on("webchat:message", async (payload: { text: string; visitorInfo?: any }) => {
      try {
        const { handleWidgetMessage } = await import("./services/widgetService.js");
        const { emitConversationEvent } = await import("./services/socketService.js");
        const result = await handleWidgetMessage(tenantId, visitorId, payload.text, payload.visitorInfo);

        // Notify agents on the main namespace
        const messagePayload = {
          conversationId: result.conversationId,
          MessageId: result.messageId,
          direction: "IN",
          text: result.text,
          senderExternalId: result.visitorId,
          CreatedAt: result.createdAt
        };
        emitConversationEvent(io, tenantId, result.conversationId, "message:new", messagePayload);
        emitConversationEvent(io, tenantId, result.conversationId, "conversation:updated", {
          ConversationId: result.conversationId,
          LastMessageAt: result.createdAt,
          ContactName: result.contactName
        });
      } catch (err) {
        logger.error({ err, tenantId, visitorId }, "[Widget Socket] Error handling message");
      }
    });
  });
});
