/**
 * ============================================================================
 * AltDesk Email Providers — Interfaces Base
 * ============================================================================
 * 
 * Define os contratos que cada provider de email deve implementar.
 * 
 * O padrão é simples:
 * - InboundEmailProvider: sabe LER emails de uma caixa
 * - OutboundEmailProvider: sabe ENVIAR emails
 * 
 * Cada provider concreto (IMAP, Gmail API, Microsoft Graph) implementa
 * estas interfaces de forma diferente, mas o worker e o serviço de envio
 * não precisam de saber qual está a ser usado — o ProviderFactory resolve isso.
 */

import type { EmailChannel, EmailInboundSettings, EmailOutboundSettings, RawEmailMessage, OutboundEmailPayload } from "../../types/emailTypes.js";

// ---------------------------------------------------------------------------
// Inbound Provider — lê emails
// ---------------------------------------------------------------------------

export interface InboundEmailProvider {
    /**
     * Conecta à caixa de email e busca mensagens novas (desde o último UID processado).
     * 
     * @param channel - Configuração do canal
     * @param settings - Settings de entrada (host, port, credentials)
     * @returns Array de mensagens brutas (não normalizadas)
     * 
     * @throws Error se a conexão falhar (o worker deve tratar e logar o erro)
     */
    fetchNewMessages(
        channel: EmailChannel,
        settings: EmailInboundSettings
    ): Promise<RawEmailMessage[]>;

    /**
     * Testa a conexão ao servidor de email.
     * Usado pela rota POST /email-channels/:id/test-inbound.
     * 
     * @returns true se a conexão foi bem-sucedida
     * @throws Error com mensagem explicativa se falhar
     */
    testConnection(
        channel: EmailChannel,
        settings: EmailInboundSettings
    ): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Outbound Provider — envia emails
// ---------------------------------------------------------------------------

export interface OutboundEmailProvider {
    /**
     * Envia um email.
     * 
     * @param channel - Configuração do canal
     * @param settings - Settings de saída (host, port, credentials)
     * @param payload - O email a enviar (to, subject, body, headers de threading)
     * @returns O Message-ID do email enviado (crucial para threading futuro)
     * 
     * @throws Error se o envio falhar (o serviço deve enfileirar para retry)
     */
    sendEmail(
        channel: EmailChannel,
        settings: EmailOutboundSettings,
        payload: OutboundEmailPayload
    ): Promise<{ messageId: string }>;

    /**
     * Testa o envio de email (envia um email de teste para o próprio endereço).
     * Usado pela rota POST /email-channels/:id/test-outbound.
     */
    testConnection(
        channel: EmailChannel,
        settings: EmailOutboundSettings
    ): Promise<boolean>;
}
