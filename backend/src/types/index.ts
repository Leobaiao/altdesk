import { Request } from "express";

export interface Permissions {
    dashboard: boolean;
    chat: boolean;
    tickets: boolean;
    contacts: boolean;
    reports: boolean;
    billing: boolean;
    users: boolean;
    settings: boolean;
}

/**
 * Representa o usuário autenticado no JWT
 */
export interface AuthUser {
    userId: string;
    tenantId: string | null;
    role: 'AGENT' | 'ADMIN' | 'SUPERADMIN' | 'SUPERVISOR' | 'END_USER';
    displayName?: string;
    email?: string;
    position?: string;
    permissions?: Permissions;
}

/**
 * Estende o Request do Express para incluir o usuário tipado
 */
export interface AuthenticatedRequest extends Request {
    user: AuthUser;
    rawBody?: Buffer;
}

/**
 * Estrutura de um Conector de Canal (ChannelConnector)
 */
export interface Connector {
    ConnectorId: string;
    ChannelId: string;
    Provider: string;
    ConfigJson: string | Record<string, any>;
    WebhookSecret?: string;
    IsActive?: boolean;
}
