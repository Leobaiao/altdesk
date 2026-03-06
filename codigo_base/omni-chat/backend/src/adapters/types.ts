export type NormalizedInbound = {
  tenantId: string;
  channel: "WHATSAPP" | "WEBCHAT";
  provider: "GTI" | "ZAPI" | "OFFICIAL" | "WEBCHAT";
  externalChatId: string;
  externalUserId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image"|"audio"|"video"|"document";
  timestamp: number;
  raw: any;
};

export interface ChannelAdapter {
  provider: NormalizedInbound["provider"];
  parseInbound(body: any, connector: any): NormalizedInbound | null;
  sendText(connector: any, toExternalUserId: string, text: string): Promise<void>;
  sendMenu?(connector: any, toExternalUserId: string, title: string, options: Array<{ id: string; text: string }>): Promise<void>;
}
