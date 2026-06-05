import { Connector } from "../types/index.js";

export type NormalizedInbound = {
  tenantId: string;
  channel: "WHATSAPP" | "WEBCHAT" | "EMAIL" | "PORTAL";
  provider: "GTI" | "ZAPI" | "OFFICIAL" | "WEBCHAT" | "SMTP" | "INTERNAL";
  externalChatId: string;
  externalUserId: string;
  externalMessageId?: string;
  senderName?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "audio" | "video" | "document";
  inReplyTo?: string;
  references?: string;
  subject?: string;
  source?: string;
  channelType?: string;
  campaign?: string;
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
  parseInbound(body: any, connector: Connector): NormalizedInbound | null;
  parseStatusUpdate?(body: any, connector: Connector): StatusUpdate | null;
  sendText(connector: Connector, toExternalUserId: string, text: string, options?: { inReplyTo?: string, subject?: string }): Promise<string | undefined>;
  sendMenu?(connector: Connector, toExternalUserId: string, title: string, options: Array<{ id: string; text: string }>): Promise<void>;
  sendMedia?(
    connector: Connector,
    toExternalUserId: string,
    mediaUrl: string,
    mediaType: "image" | "audio" | "video" | "document",
    caption?: string,
    options?: { inReplyTo?: string, subject?: string }
  ): Promise<string | undefined>;
  setWebhook?(connector: Connector, options: {
    url: string;
    enabled?: boolean;
    events?: string[];
    excludeMessages?: string[];
    addUrlEvents?: boolean;
    addUrlTypesMessages?: boolean;
  }): Promise<void>;
  getWebhook?(connector: Connector): Promise<any>;
  removeWebhook?(connector: Connector, webhookId: string): Promise<void>;
}
