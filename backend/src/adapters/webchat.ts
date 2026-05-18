import { ChannelAdapter, NormalizedInbound } from "./types.js";
import { logger } from "../lib/logger.js";

/**
 * WebChat Adapter
 * Recebe mensagens via POST /api/external/webchat/message
 */
export class WebChatAdapter implements ChannelAdapter {
    provider = "WEBCHAT" as const;

    parseInbound(body: any, connector: any): NormalizedInbound | null {
        // Body esperado: { senderId, text, mediaUrl, mediaType, timestamp }
        if (!body.senderId || !body.text) return null;

        return {
            tenantId: connector.TenantId,
            channel: "WEBCHAT",
            provider: "WEBCHAT",
            externalChatId: body.senderId,
            externalUserId: body.senderId,
            text: body.text,
            mediaUrl: body.mediaUrl,
            mediaType: body.mediaType,
            timestamp: body.timestamp || Date.now(),
            raw: body
        };
    }

    async sendText(connector: any, toExternalUserId: string, text: string, options?: { inReplyTo?: string }): Promise<string | undefined> {
        // No WebChat, a resposta é enviada via Socket.IO para o cliente conectado.
        // O backend já faz emit("message:new", ...) no index.ts.
        logger.debug({ toExternalUserId }, "[WEBCHAT] Enviando mensagem");
        return undefined;
    }
}

