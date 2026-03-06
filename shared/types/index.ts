export type Role = "SUPERADMIN" | "ADMIN" | "AGENT";

export interface User {
    UserId: string;
    TenantId: string;
    Name: string;
    Email: string;
    Role: Role;
    IsActive: boolean;
    CreatedAt?: string;
    AgentName?: string;
    TenantName?: string;
}

export interface Tenant {
    TenantId: string;
    Name: string;
    IsActive?: boolean;
}

export interface Conversation {
    ConversationId: string;
    TenantId?: string;
    Title: string;
    Status: "OPEN" | "RESOLVED";
    Kind: "WHATSAPP" | "WEBCHAT" | "INTERNAL";
    CreatedAt?: string;
    LastMessageAt: string;
    ExternalUserId: string;
    UnreadCount: number;
    QueueId?: string | null;
    QueueName?: string | null;
    AssignedUserId?: string | null;
}

export interface Message {
    MessageId: string;
    ConversationId?: string;
    Body: string;
    Direction: "IN" | "OUT";
    SenderExternalId: string;
    SenderUserId?: string | null;
    MediaType?: "image" | "audio" | "video" | "document" | null;
    MediaUrl?: string | null;
    Status?: "SENT" | "DELIVERED" | "READ" | "FAILED" | null;
    CreatedAt: string;
}

export interface Queue {
    QueueId: string;
    TenantId?: string;
    Name: string;
    IsActive: boolean;
}

export interface CannedResponse {
    CannedResponseId: string;
    TenantId?: string;
    Shortcut: string;
    Content: string;
    Title: string;
}

export interface ChannelConnector {
    ConnectorId: string;
    TenantId: string;
    Provider: "WHATSAPP" | "WEBCHAT"; // Added WEBCHAT if applicable, mostly it's GTI or BAILEYS though
    AdapterConfig: any; // Ideally JSON string or specific type
    IsActive: boolean;
    CreatedAt?: string;
}
