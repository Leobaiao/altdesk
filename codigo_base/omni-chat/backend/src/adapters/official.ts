import { ChannelAdapter, NormalizedInbound } from "./types.js";

/**
 * Placeholder WhatsApp Oficial (Cloud API/BSP).
 * Regras: janela 24h e templates fora da janela.
 */
export class OfficialAdapter implements ChannelAdapter {
  provider = "OFFICIAL" as const;

  parseInbound(body: any, connector: any): NormalizedInbound | null {
    // TODO: mapear webhook da Cloud API/BSP
    void connector;
    return {
      tenantId: connector.TenantId,
      channel: "WHATSAPP",
      provider: "OFFICIAL",
      externalChatId: String(body?.wa_id ?? body?.from ?? ""),
      externalUserId: String(body?.from ?? ""),
      text: body?.text ?? undefined,
      timestamp: Date.now(),
      raw: body
    };
  }

  async sendText(connector: any, toExternalUserId: string, text: string): Promise<void> {
    void connector; void toExternalUserId; void text;
    throw new Error("OFFICIAL sendText() placeholder.");
  }
}
