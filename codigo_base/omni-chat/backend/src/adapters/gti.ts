import { ChannelAdapter, NormalizedInbound } from "./types.js";

/**
 * GTI Adapter
 * TODO: mapear campos reais conforme payload do webhook e requests do Postman.
 * Coloque samples em: docs/vendors/gti/sample-webhook-*.json
 */
export class GtiAdapter implements ChannelAdapter {
  provider = "GTI" as const;

  parseInbound(body: any, connector: any): NormalizedInbound | null {
    // TODO: substituir por mapeamento real
    // Estratégia de MVP: se não houver chatId, usar externalUserId como thread.
    const externalUserId = String(body?.from ?? body?.sender ?? body?.phone ?? "");
    if (!externalUserId) return null;

    const externalChatId = String(body?.chatId ?? body?.threadId ?? externalUserId);
    const text = body?.text ?? body?.message?.text ?? body?.mensagem ?? undefined;

    return {
      tenantId: connector.TenantId,
      channel: "WHATSAPP",
      provider: "GTI",
      externalChatId,
      externalUserId,
      text,
      timestamp: Number(body?.timestamp ?? Date.now()),
      raw: body
    };
  }

  async sendText(connector: any, to: string, text: string): Promise<void> {
    // TODO: implementar com base na collection Postman exportada.
    // Exemplo esperado:
    // - baseUrl (cfg.baseUrl)
    // - token/apikey (cfg.token)
    // - instance/rota (cfg.instance)
    // Use fetch/axios (adicionar dependency) ou https nativo.
    const cfg = JSON.parse(connector.ConfigJson);
    void cfg; void to; void text;
    throw new Error("GTI sendText() não implementado: importar endpoint/headers/body da doc GTI.");
  }

  async sendMenu(connector: any, to: string, title: string, options: Array<{ id: string; text: string }>) {
    // TODO: implementar "enviar-menu" conforme request do Postman (link do usuário).
    const cfg = JSON.parse(connector.ConfigJson);
    void cfg; void to; void title; void options;
    throw new Error("GTI sendMenu() não implementado: importar endpoint/headers/body da doc GTI.");
  }
}
