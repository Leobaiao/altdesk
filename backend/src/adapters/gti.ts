import { ChannelAdapter, NormalizedInbound, StatusUpdate } from "./types.js";

/**
 * GTI Adapter (uazapi)
 * Mapeamento baseado no payload real do webhook GTI/uazapi.
 *
 * Payload de mensagem (EventType: "messages"):
 *   body.message.sender_pn  → telefone do remetente (ex: "5511976131029@s.whatsapp.net")
 *   body.message.chatid      → ID do chat (ex: "5511976131029@s.whatsapp.net")
 *   body.message.text         → texto da mensagem
 *   body.message.messageTimestamp → timestamp em ms
 *   body.message.senderName  → nome do remetente
 *   body.chat.name            → nome do contato
 *   body.chat.phone           → telefone formatado
 */
export class GtiAdapter implements ChannelAdapter {
  provider = "GTI" as const;

  parseInbound(body: any, connector: any): NormalizedInbound | null {
    // Só processar eventos de mensagem
    if (body?.EventType !== "messages") {
      console.log(`[GTI] Evento ignorado: ${body?.EventType}`);
      return null;
    }

    const msg = body?.message;
    if (!msg) return null;

    // sender_pn contém o telefone no formato WhatsApp (ex: "5511976131029@s.whatsapp.net")
    const externalUserId = String(msg.sender_pn ?? msg.chatid ?? "");
    if (!externalUserId) return null;

    const externalChatId = String(msg.chatid ?? externalUserId);

    // Detectar tipo e extrair conteúdo
    const type = msg.type ?? "text"; // text, image, audio, video, document, sticker...
    let text = msg.text ?? msg.content ?? undefined;
    let mediaUrl: string | undefined;
    let mediaType: NormalizedInbound["mediaType"];

    if (type === "image") {
      mediaType = "image";
      mediaUrl = msg.url ?? msg.insecureUrl; // GTI costuma mandar 'url'
      text = msg.caption ?? text; // Se for imagem, o texto pode vir no caption
    } else if (type === "audio" || type === "ptt") {
      mediaType = "audio";
      mediaUrl = msg.url;
    } else if (type === "video") {
      mediaType = "video";
      mediaUrl = msg.url;
      text = msg.caption ?? text;
    } else if (type === "document") {
      mediaType = "document";
      mediaUrl = msg.url;
      text = msg.caption ?? msg.fileName ?? text;
    }

    console.log(`[GTI] Mensagem de ${body.chat?.name ?? externalUserId}: ${type} "${text ?? '[media]'}"}`);

    const senderName = body.chat?.name || msg.senderName || undefined;

    return {
      tenantId: connector.TenantId,
      channel: "WHATSAPP",
      provider: "GTI",
      externalChatId,
      externalUserId,
      externalMessageId: msg.id ?? msg.messageId ?? undefined,
      senderName,
      text,
      mediaUrl,
      mediaType,
      timestamp: Number(msg.messageTimestamp ?? Date.now()),
      raw: body
    };
  }

  parseStatusUpdate(body: any, connector: any): StatusUpdate | null {
    if (body?.EventType !== "messages_update") return null;

    const msg = body?.message;
    if (!msg) return null;

    const msgId = msg.id ?? msg.messageId;
    if (!msgId) return null;

    // GTI status mapping: "delivered" → DELIVERED, "read" → READ
    let status: "DELIVERED" | "READ" | null = null;
    const rawStatus = String(msg.status ?? msg.ack ?? "").toLowerCase();

    if (rawStatus === "read" || rawStatus === "4" || rawStatus === "played") {
      status = "READ";
    } else if (rawStatus === "delivered" || rawStatus === "3" || rawStatus === "received") {
      status = "DELIVERED";
    }

    if (!status) {
      console.log(`[GTI] Status update ignorado para msg ${msgId}: status="${rawStatus}"`);
      return null;
    }

    console.log(`[GTI] Status update: msg ${msgId} → ${status}`);

    return {
      tenantId: connector.TenantId,
      externalMessageId: msgId,
      status
    };
  }

  async sendText(connector: any, to: string, text: string): Promise<void> {
    if (!connector.ConfigJson) {
      throw new Error(`Configuração do conector GTI (${connector.ConnectorId}) está vazia.`);
    }
    const cfg = JSON.parse(connector.ConfigJson);
    // BaseUrl real da GTI/uazapi
    const baseUrl = cfg.baseUrl ?? "https://api.gtiapi.workers.dev";
    const url = `${baseUrl}/send/text`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": cfg.token || cfg.apiKey
      },
      body: JSON.stringify({
        instance: cfg.instance,
        number: to,
        text: text
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`GTI sendText() falhou: ${response.status} ${response.statusText} - ${errBody}`);
    }
  }

  async sendMenu(connector: any, to: string, title: string, options: Array<{ id: string; text: string }>) {
    const cfg = JSON.parse(connector.ConfigJson);
    const baseUrl = cfg.baseUrl ?? "https://api.gtiapi.workers.dev";
    // TODO: implementar quando soubermos o endpoint correto do menu na GTI/uazapi
    void baseUrl; void to; void title; void options;
    throw new Error("GTI sendMenu() não implementado: importar endpoint/headers/body da doc GTI.");
  }

  async setWebhook(connector: any, options: {
    url: string;
    enabled?: boolean;
    events?: string[];
    excludeMessages?: string[];
    addUrlEvents?: boolean;
    addUrlTypesMessages?: boolean;
  }): Promise<void> {
    const cfg = JSON.parse(connector.ConfigJson);
    const baseUrl = cfg.baseUrl ?? "https://api.gtiapi.workers.dev";
    const url = `${baseUrl}/webhook`;

    const payload = {
      instance: cfg.instance,
      enabled: options.enabled ?? true,
      url: options.url,
      events: options.events || [
        "connection", "history", "messages", "messages_update",
        "call", "contacts", "presence", "groups", "labels",
        "chats", "chat_labels", "blocks", "leads"
      ],
      excludeMessages: options.excludeMessages || [
        "wasSentByApi", "wasNotSentByApi", "fromMeYes", "fromMeNo", "isGroupYes", "IsGroupNo"
      ],
      addUrlEvents: options.addUrlEvents ?? true,
      addUrlTypesMessages: options.addUrlTypesMessages ?? true,
      action: "add"
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": cfg.token || cfg.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`GTI setWebhook() falhou: ${response.status} - ${errBody}`);
    }
  }

  async getWebhook(connector: any): Promise<any> {
    const cfg = JSON.parse(connector.ConfigJson);
    const baseUrl = cfg.baseUrl ?? "https://api.gtiapi.workers.dev";
    const url = `${baseUrl}/webhook`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "token": cfg.token || cfg.apiKey
      }
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`GTI getWebhook() falhou: ${response.status} - ${errBody}`);
    }

    return await response.json();
  }

  async removeWebhook(connector: any, webhookId: string): Promise<void> {
    const cfg = JSON.parse(connector.ConfigJson);
    const baseUrl = cfg.baseUrl ?? "https://api.gtiapi.workers.dev";
    const url = `${baseUrl}/webhook`;

    const payload = {
      action: "delete",
      id: webhookId
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": cfg.token || cfg.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`GTI removeWebhook() falhou: ${response.status} - ${errBody}`);
    }
  }
}
