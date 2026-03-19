import { Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { logger } from "../lib/logger.js";

/** Threshold em ms para alertar requisições lentas */
const SLOW_REQUEST_THRESHOLD_MS = 2000;

/**
 * Middleware que loga todas as requisições HTTP com:
 * - requestId único para correlação de logs
 * - método, URL, status, latência
 * - userId e tenantId (quando autenticado)
 * - alerta para requisições lentas (> 2s)
 */
export function requestLogger(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    const requestId = uuid();
    (req as any).requestId = requestId;

    const start = Date.now();

    // Logar ao finalizar a resposta (quando temos o status code)
    res.on("finish", () => {
        const latencyMs = Date.now() - start;
        const user = (req as any).user;

        const logData = {
            requestId,
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            latencyMs,
            ip: req.ip || req.socket?.remoteAddress,
            userId: user?.userId,
            tenantId: user?.tenantId,
            userAgent: req.headers["user-agent"]?.substring(0, 100)
        };

        if (res.statusCode >= 500) {
            logger.error(logData, "HTTP 5xx error");
        } else if (res.statusCode >= 400) {
            logger.warn(logData, "HTTP 4xx response");
        } else if (latencyMs > SLOW_REQUEST_THRESHOLD_MS) {
            logger.warn({ ...logData, alert: "SLOW_REQUEST" }, `Slow request detected (${latencyMs}ms)`);
        } else {
            // Ignorar logs de rotas muito frequentes e de baixo valor (health checks etc.)
            const skipPatterns = ["/api/health", "/favicon"];
            if (!skipPatterns.some(p => req.originalUrl.startsWith(p))) {
                logger.info(logData, `${req.method} ${req.originalUrl}`);
            }
        }
    });

    next();
}
