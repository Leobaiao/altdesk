import { ChannelAdapter, NormalizedInbound } from "./types.js";

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

    async sendText(connector: any, toExternalUserId: string, text: string): Promise<void> {
        // No WebChat, a resposta é enviada via Socket.IO para o cliente conectado.
        // O backend já faz emit("message:new", ...) no index.ts.
        // Portanto, este método pode ser "no-op" ou usar um mecanismo de push específico se o widget não estiver conectado.
        // Para MVP, assumimos que o widget está conectado via socket na sala da conversa.
        // Mas o 'index.ts' chama adapter.sendText().
        // Se deixarmos vazio, o 'index.ts' ainda vai emitir o evento socket.
        // Então, ok.
        console.log(`[WEBCHAT] Enviando para ${toExternalUserId}: ${text}`);
    }
}
