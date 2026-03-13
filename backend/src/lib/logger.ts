import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Logger centralizado do AltDesk.
 * Em desenvolvimento: output colorido e legível (pino-pretty).
 * Em produção: JSON newline-delimited para coleta por ferramentas externas.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    base: { service: "altdesk-api" },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: isDev
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname,service",
                messageFormat: "{msg}"
            }
        }
        : undefined
});

/**
 * Cria um logger filho com contexto adicional (ex: requestId, tenantId).
 */
export function childLogger(context: Record<string, unknown>) {
    return logger.child(context);
}
