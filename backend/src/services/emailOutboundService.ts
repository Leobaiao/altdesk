/**
 * ============================================================================
 * AltDesk — Email Outbound Service
 * ============================================================================
 * 
 * Serviço responsável por enviar respostas do agente por email.
 * 
 * Fluxo:
 * 1. Agente escreve resposta no Altdesk
 * 2. Este serviço é chamado para enviar o email
 * 3. Resolve o canal de email associado ao ticket/conversa
 * 4. Constrói o email com headers de threading corretos
 * 5. Envia via provider (SMTP no MVP)
 * 6. Guarda o Message-ID na tabela EmailMessageMeta (CRUCIAL para threading)
 * 7. Se falhar: enfileira na retry queue (não perde a resposta!)
 * 
 * Regra de negócio do spec:
 * "Falha de envio não pode descartar a resposta do agente; deve haver fila de retry."
 */

import { logger } from "../lib/logger.js";
import { decrypt } from "../lib/encryption.js";
import {
    getEmailChannelById,
    getOutboundSettings,
    saveEmailMessageMeta,
    getLatestEmailMetaForConversation,
    getEmailThreadMessageIds,
    enqueueEmailRetry,
    getPendingRetries,
    updateRetryItem,
} from "./emailRepository.js";
import { createOutboundProvider } from "./emailProviders/providerFactory.js";
import { buildReplySubject } from "./emailNormalizer.js";
import { getPool } from "../db.js";
import type { OutboundEmailPayload } from "../types/emailTypes.js";

/**
 * Envia uma resposta de ticket por email.
 * 
 * @param params - Dados para envio
 * @returns O Message-ID do email enviado
 * @throws Error se falhar (o caller deve tratar ou enfileirar)
 */
export async function sendTicketReply(params: {
    conversationId: string;
    tenantId: string;
    bodyHtml: string;
    bodyText?: string;
    toAddress: string;
}): Promise<string | null> {
    const { conversationId, tenantId, bodyHtml, bodyText, toAddress } = params;

    // 1. Descobrir qual canal de email está associado a esta conversa
    const channelInfo = await resolveEmailChannel(tenantId, conversationId);
    if (!channelInfo) {
        logger.warn(
            { conversationId, tenantId },
            "[EmailOutbound] No email channel found for conversation — skipping email send"
        );
        return null;
    }

    const { channel, ticketId, originalSubject } = channelInfo;

    // 2. Buscar configurações de saída
    const outboundSettings = await getOutboundSettings(channel.EmailChannelId);
    if (!outboundSettings) {
        logger.error(
            { channelId: channel.EmailChannelId },
            "[EmailOutbound] No outbound settings for channel"
        );
        return null;
    }

    // 3. Desencriptar password
    const decryptedSettings = { ...outboundSettings };
    if (outboundSettings.EncryptedPassword) {
        try {
            decryptedSettings.EncryptedPassword = decrypt(outboundSettings.EncryptedPassword);
        } catch (err) {
            logger.error({ err, channelId: channel.EmailChannelId }, "[EmailOutbound] Failed to decrypt password");
            return null;
        }
    }

    // 4. Construir headers de threading
    const lastMeta = await getLatestEmailMetaForConversation(conversationId);
    const threadMessageIds = await getEmailThreadMessageIds(conversationId);

    const inReplyTo = lastMeta?.EmailMessageIdHeader || undefined;
    const references = threadMessageIds.length > 0
        ? threadMessageIds.join(" ")
        : undefined;

    // 5. Construir o assunto com o ticket code
    const subject = ticketId
        ? buildReplySubject(originalSubject || "Atendimento", ticketId)
        : `Re: ${originalSubject || "Atendimento"}`;

    // 6. Construir o payload
    const brandColor = "#00a884";
    const headerHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
            <div style="background-color: ${brandColor}; padding: 20px; text-align: center;">
                <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Atendimento AltDesk</h2>
            </div>
            <div style="padding: 30px; background-color: #ffffff;">
                ${bodyHtml}
            </div>
            <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee; font-size: 12px; color: #777;">
                Este é um email automático enviado pelo sistema AltDesk.<br>
                Por favor, responda a este email para continuar o atendimento.<br>
                <strong>Ticket: [TCK-${ticketId?.split("-")[0].toUpperCase()}]</strong>
            </div>
        </div>
    `;

    const payload: OutboundEmailPayload = {
        to: toAddress,
        subject,
        html: headerHtml,
        text: bodyText,
        inReplyTo,
        references,
    };

    // 7. Enviar
    try {
        const provider = createOutboundProvider(channel.ProviderType);
        const result = await provider.sendEmail(channel, decryptedSettings, payload);

        // 8. Guardar metadados de threading (CRUCIAL!)
        await saveEmailMessageMeta({
            TenantId: tenantId,
            ConversationId: conversationId,
            MessageId: null,
            EmailChannelId: channel.EmailChannelId,
            EmailMessageIdHeader: result.messageId,
            InReplyTo: inReplyTo || null,
            ReferencesHeader: references
                ? `${references} ${result.messageId}`
                : result.messageId,
            Direction: "OUT",
        });

        logger.info(
            { conversationId, messageId: result.messageId, to: toAddress },
            "[EmailOutbound] Reply sent successfully"
        );

        return result.messageId;
    } catch (err) {
        logger.error(
            { err, conversationId, to: toAddress },
            "[EmailOutbound] Failed to send reply — enqueueing for retry"
        );

        // 9. REGRA DE NEGÓCIO: Não perder a resposta! Enfileirar para retry.
        try {
            await enqueueEmailRetry({
                TenantId: tenantId,
                EmailChannelId: channel.EmailChannelId,
                ConversationId: conversationId,
                ToAddress: toAddress,
                Subject: subject,
                BodyHtml: bodyHtml,
                BodyText: bodyText || null,
                InReplyTo: inReplyTo || null,
                ReferencesHeader: references || null,
                AttachmentsJson: null,
            });
        } catch (retryErr) {
            logger.error({ err: retryErr, conversationId }, "[EmailOutbound] Failed to enqueue retry!");
        }

        return null;
    }
}

/**
 * Processa a fila de retry — chamado periodicamente pelo worker.
 */
export async function processRetryQueue(): Promise<void> {
    const pendingRetries = await getPendingRetries();

    if (pendingRetries.length === 0) return;

    logger.info({ count: pendingRetries.length }, "[EmailOutbound] Processing retry queue");

    for (const item of pendingRetries) {
        try {
            const channel = await getEmailChannelById(item.EmailChannelId);
            if (!channel || !channel.IsActive) {
                await updateRetryItem(item.RetryId, false, "Channel no longer active");
                continue;
            }

            const outboundSettings = await getOutboundSettings(channel.EmailChannelId);
            if (!outboundSettings) {
                await updateRetryItem(item.RetryId, false, "No outbound settings");
                continue;
            }

            const decryptedSettings = { ...outboundSettings };
            if (outboundSettings.EncryptedPassword) {
                decryptedSettings.EncryptedPassword = decrypt(outboundSettings.EncryptedPassword);
            }

            const provider = createOutboundProvider(channel.ProviderType);
            const result = await provider.sendEmail(channel, decryptedSettings, {
                to: item.ToAddress,
                subject: item.Subject,
                html: item.BodyHtml,
                text: item.BodyText || undefined,
                inReplyTo: item.InReplyTo || undefined,
                references: item.ReferencesHeader || undefined,
            });

            // Sucesso! Salvar metadados de threading
            await saveEmailMessageMeta({
                TenantId: item.TenantId,
                ConversationId: item.ConversationId,
                MessageId: null,
                EmailChannelId: item.EmailChannelId,
                EmailMessageIdHeader: result.messageId,
                InReplyTo: item.InReplyTo,
                ReferencesHeader: item.ReferencesHeader
                    ? `${item.ReferencesHeader} ${result.messageId}`
                    : result.messageId,
                Direction: "OUT",
            });

            await updateRetryItem(item.RetryId, true);
            logger.info({ retryId: item.RetryId, to: item.ToAddress }, "[EmailOutbound] Retry successful");
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            await updateRetryItem(item.RetryId, false, errMsg);
            logger.error(
                { err, retryId: item.RetryId, attempt: item.RetryCount + 1 },
                "[EmailOutbound] Retry failed"
            );
        }
    }
}

// ============================================================================
// Funções auxiliares
// ============================================================================

/**
 * Resolve o canal de email associado a uma conversa.
 * Tenta encontrar via EmailMessageMeta → EmailChannel, ou via ExternalThreadMap.
 */
async function resolveEmailChannel(tenantId: string, conversationId: string): Promise<{
    channel: NonNullable<Awaited<ReturnType<typeof getEmailChannelById>>>;
    ticketId: string | null;
    originalSubject: string | null;
} | null> {
    const pool = await getPool();

    // Primeiro: verificar se há metadados de email para esta conversa
    const metaResult = await pool.request()
        .input("conversationId", conversationId)
        .query(`
            SELECT TOP 1 em.EmailChannelId
            FROM altdesk.EmailMessageMeta em
            WHERE em.ConversationId = @conversationId AND em.EmailChannelId IS NOT NULL
            ORDER BY em.CreatedAt DESC
        `);

    let emailChannelId: string | null = metaResult.recordset[0]?.EmailChannelId || null;

    // Fallback: verificar via ChannelConnector se o canal é EMAIL
    if (!emailChannelId) {
        const connResult = await pool.request()
            .input("conversationId", conversationId)
            .input("tenantId", tenantId)
            .query(`
                SELECT TOP 1 cc.ConfigJson
                FROM altdesk.ExternalThreadMap etm
                JOIN altdesk.ChannelConnector cc ON cc.ConnectorId = etm.ConnectorId
                WHERE etm.ConversationId = @conversationId AND etm.TenantId = @tenantId AND cc.Provider = 'SMTP'
            `);

        if (connResult.recordset.length > 0) {
            try {
                const config = JSON.parse(connResult.recordset[0].ConfigJson);
                emailChannelId = config.emailChannelId;
            } catch { /* ignore */ }
        }
    }

    if (!emailChannelId) return null;

    const channel = await getEmailChannelById(emailChannelId);
    if (!channel) return null;

    // Buscar ticket e assunto original
    const ticketResult = await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .query(`
            SELECT TOP 1 t.TicketId, c.Title, c.ContextData
            FROM altdesk.Conversation c
            LEFT JOIN altdesk.Ticket t ON t.ConversationId = c.ConversationId 
                AND t.TenantId = @tenantId AND t.Status != 'CLOSED' AND t.DeletedAt IS NULL
            WHERE c.ConversationId = @conversationId AND c.TenantId = @tenantId
        `);

    const ticketId = ticketResult.recordset[0]?.TicketId || null;
    let originalSubject = ticketResult.recordset[0]?.Title || null;

    // Tentar extrair o subject do ContextData (se foi guardado pelo conversation service)
    try {
        const contextData = ticketResult.recordset[0]?.ContextData;
        if (contextData) {
            const ctx = JSON.parse(contextData);
            if (ctx.subject) originalSubject = ctx.subject;
        }
    } catch { /* ignore */ }

    return { channel, ticketId, originalSubject };
}
