import rateLimit from "express-rate-limit";

// Limitador para autenticação (Login)
// Mais rígido para evitar força bruta
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 10, // Limite de 10 tentativas por IP
    message: { error: "Muitas tentativas de login. Tente novamente após 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Limitador para Webhooks
// Moderado para suportar picos de mensagens
export const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    limit: 100, // Limite de 100 requisições por IP
    message: { error: "Limite de processamento de webhooks excedido." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Limitador Global da API
// Proteção genérica contra abusos
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 500, // Limite de 500 requisições
    message: { error: "Limite de requisições excedido. Tente novamente mais tarde." },
    standardHeaders: true,
    legacyHeaders: false,
});
