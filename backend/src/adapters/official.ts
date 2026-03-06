import { ChannelAdapter, NormalizedInbound } from "./types.js";

/**
 * Placeholder WhatsApp Oficial (Cloud API/BSP).
 * Regras: janela 24h e templates fora da janela.
 */
export class OfficialAdapter implements ChannelAdapter {
  provider = "OFFICIAL" as const;

  parseInbound(body: any, connector: any): NormalizedInbound | null {
    try {
      // Estrutura padrão da Cloud API
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message) return null;

      const contact = value?.contacts?.[0];
      const senderName = contact?.profile?.name;
      const senderPhone = message.from; // ex: "5511999999999"

      const type = message.type;
      let text = undefined;
      let mediaType: NormalizedInbound["mediaType"] = undefined;
      let mediaUrl: string | undefined = undefined;

      if (type === "text") {
        text = message.text?.body;
      } else if (type === "image") {
        mediaType = "image";
        mediaUrl = message.image?.id; // Cloud API manda ID, precisa baixar. MVP: salva ID.
        text = message.image?.caption;
      } else if (type === "audio" || type === "voice") {
        mediaType = "audio";
        mediaUrl = message.audio?.id || message.voice?.id;
      } else if (type === "document") {
        mediaType = "document";
        mediaUrl = message.document?.id;
        text = message.document?.caption;
      } else if (type === "video") {
        mediaType = "video";
        mediaUrl = message.video?.id;
        text = message.video?.caption;
      }

      return {
        tenantId: connector.TenantId,
        channel: "WHATSAPP",
        provider: "OFFICIAL",
        externalChatId: senderPhone,
        externalUserId: senderPhone,
        text,
        mediaType,
        mediaUrl, // Nota: Aqui é o Media ID do Facebook. Precisaria de outro endpoint para baixar.
        timestamp: Number(message.timestamp) * 1000,
        raw: body
      };
    } catch (e) {
      console.error("[OFFICIAL] Parse error:", e);
      return null;
    }
  }

  async sendText(connector: any, toExternalUserId: string, text: string): Promise<void> {
    const config = JSON.parse(connector.ConfigJson || "{}");
    const { phoneNumberId, accessToken } = config;

    if (!phoneNumberId || !accessToken) {
      throw new Error("Missing phoneNumberId or accessToken for OFFICIAL connector");
    }

    // Clean phone number (remove @s.whatsapp.net if present, though Official uses raw numbers)
    let phone = toExternalUserId.replace("@s.whatsapp.net", "").replace(/\D/g, "");

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

    // Se a janela de 24h fechou, isso falhará se não for template.
    // MVP: assume janela aberta.
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "text",
      text: { preview_url: false, body: text }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("[OFFICIAL] Send error:", JSON.stringify(err, null, 2));
      throw new Error(`WhatsApp API Error: ${err.error?.message || res.statusText}`);
    }
  }
}
