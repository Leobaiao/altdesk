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

// Limitador para Onboarding (Vendas/Cadastro)
// Um pouco mais generoso para permitir correções de formulário sem bloqueio agressivo
export const onboardingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    limit: 15, // 15 tentativas permitidas por IP no cadastro
    message: { error: "Muitas tentativas de cadastro. Tente novamente após alguns minutos." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Limitador para Webhooks
// Moderado para suportar picos de mensagens
export const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    limit: 2000, // Limite de 2000 requisições por minuto (essencial para sync de contatos)
    message: { error: "Limite de processamento de webhooks excedido." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Limitador Global da API
// Proteção genérica contra abusos
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 5000, // Limite de 5000 requisições (mais generoso para bots ativos)
    message: { error: "Limite de requisições excedido. Tente novamente mais tarde." },
    standardHeaders: true,
    legacyHeaders: false,
});
