import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validateMw.js";
import { logger } from "../lib/logger.js";
import {
    getPublicWidgetConfig,
    handleWidgetMessage,
    getWidgetConversationHistory,
    checkWidgetAvailability
} from "../services/widgetService.js";
import { emitConversationEvent } from "../services/socketService.js";

const router = Router();

/**
 * GET /api/public/widget/:tenantId — Retorna configuração pública do widget
 * Sem autenticação. Só retorna se o widget está publicado e ativo.
 */
router.get("/:tenantId", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.params;
        const config = await getPublicWidgetConfig(tenantId);

        if (!config) {
            return res.status(404).json({ error: "Widget não encontrado ou não publicado." });
        }

        res.json({ configJson: config });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/public/widget/:tenantId/business-hours — Status de disponibilidade
 * Sem autenticação.
 */
router.get("/:tenantId/business-hours", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.params;
        const availability = await checkWidgetAvailability(tenantId);
        res.json(availability);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/public/widget/:tenantId/history/:visitorId — Histórico de mensagens
 * Sem autenticação. Retorna mensagens da conversa do visitante.
 */
router.get("/:tenantId/history/:visitorId", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId, visitorId } = req.params;
        const messages = await getWidgetConversationHistory(tenantId, visitorId);
        res.json({ messages });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/public/widget/:tenantId/message — Recebe mensagem do visitante
 * Sem autenticação. Cria Contact/Conversation se necessário.
 */
router.post("/:tenantId/message", validateBody(z.object({
    visitorId: z.string().min(1),
    text: z.string().min(1).max(5000),
    visitorInfo: z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional()
    }).optional()
})), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.params;
        const { visitorId, text, visitorInfo } = req.body;

        const result = await handleWidgetMessage(tenantId, visitorId, text, visitorInfo);

        // Emitir evento para os agentes no painel via Socket.IO principal
        const io = req.app.get("io");
        if (io) {
            const messagePayload = {
                conversationId: result.conversationId,
                MessageId: result.messageId,
                direction: "IN",
                text: result.text,
                senderExternalId: result.visitorId,
                CreatedAt: result.createdAt
            };
            emitConversationEvent(io, tenantId, result.conversationId, "message:new", messagePayload);

            // Emitir conversation:updated para atualizar a sidebar dos agentes
            emitConversationEvent(io, tenantId, result.conversationId, "conversation:updated", {
                ConversationId: result.conversationId,
                LastMessageAt: result.createdAt,
                ContactName: result.contactName
            });
        }

        res.json({
            ok: true,
            conversationId: result.conversationId,
            messageId: result.messageId,
            createdAt: result.createdAt
        });
    } catch (error) {
        logger.error({ error }, "[Widget] Erro ao processar mensagem");
        next(error);
    }
});

export default router;
