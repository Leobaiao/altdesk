export type NormalizedInbound = {
  tenantId: string;
  channel: "WHATSAPP" | "WEBCHAT";
  provider: "GTI" | "ZAPI" | "OFFICIAL" | "WEBCHAT";
  externalChatId: string;
  externalUserId: string;
  externalMessageId?: string;
  senderName?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "audio" | "video" | "document";
  timestamp: number;
  raw: any;
};

export type StatusUpdate = {
  tenantId: string;
  externalMessageId: string;
  status: "DELIVERED" | "READ";
};

export interface ChannelAdapter {
  provider: NormalizedInbound["provider"];
  parseInbound(body: any, connector: any): NormalizedInbound | null;
  parseStatusUpdate?(body: any, connector: any): StatusUpdate | null;
  sendText(connector: any, toExternalUserId: string, text: string): Promise<void>;
  sendMenu?(connector: any, toExternalUserId: string, title: string, options: Array<{ id: string; text: string }>): Promise<void>;
  setWebhook?(connector: any, options: {
    url: string;
    enabled?: boolean;
    events?: string[];
    excludeMessages?: string[];
    addUrlEvents?: boolean;
    addUrlTypesMessages?: boolean;
  }): Promise<void>;
  getWebhook?(connector: any): Promise<any>;
  removeWebhook?(connector: any, webhookId: string): Promise<void>;
}
