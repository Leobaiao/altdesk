/**
 * ============================================================================
 * AltDesk — Email Inbound Worker (Polling Worker)
 * ============================================================================
 * 
 * O "coração" do sistema de email. É um processo que corre em background,
 * de 60 em 60 segundos, e:
 * 
 * 1. Busca todos os canais de email ativos
 * 2. Para cada canal, conecta ao servidor de email (IMAP) e busca emails novos
 * 3. Para cada email novo:
 *    a. Normaliza → InboundEvent
 *    b. Verifica duplicação (Message-ID já processado?)
 *    c. Salva o evento na BD com status "pending"
 *    d. Corre o motor de correlação (threading)
 *    e. Se encontrou conversa → adiciona mensagem ao ticket existente
 *    f. Se não encontrou → cria nova conversa + ticket
 *    g. Salva metadados de threading na tabela EmailMessageMeta
 *    h. Marca o evento como "processed"
 * 4. Atualiza o lastSyncAt do canal e o lastProcessedUid
 * 
 * Analogia do guia do dev:
 * "É como um carteiro que passa pela tua caixa de correio a cada hora
 *  para ver se chegou alguma carta."
 */

import { logger } from "../lib/logger.js";
import { decrypt } from "../lib/encryption.js";
import {
    getActiveEmailChannels,
    getInboundSettings,
    saveInboundEvent,
    updateEventStatus,
    isEmailAlreadyProcessed,
    saveEmailMessageMeta,
    updateChannelSyncStatus,
    updateLastProcessedUid,
} from "./emailRepository.js";
import { createInboundProvider } from "./emailProviders/providerFactory.js";
import { normalizeRawEmail } from "./emailNormalizer.js";
import { correlateToTicket } from "./emailCorrelation.js";
import { resolveConversationForInbound, saveInboundMessage } from "./conversation.js";
import { createTicketForConversation } from "./ticketService.js";
import type { EmailChannel, EmailInboundSettings, RawEmailMessage } from "../types/emailTypes.js";
import type { NormalizedInbound } from "../adapters/types.js";

// Referência ao Socket.IO para emitir eventos em tempo real
let ioInstance: any = null;

/** Permite injectar a instância do Socket.IO (chamado no index.ts) */
export function setIoInstance(io: any): void {
    ioInstance = io;
}

class EmailInboundWorker {
    private intervalMs: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private isRunning = false;
    private isStopped = false;

    constructor(intervalMs: number = 60_000) {
        this.intervalMs = intervalMs;
    }

    /**
     * Inicia o worker de polling.
     * Executa imediatamente a primeira vez, depois repete no intervalo configurado.
     */
    start(): void {
        if (this.isRunning) {
            logger.warn("[EmailWorker] Worker already running");
            return;
        }

        this.isStopped = false;
        logger.info({ intervalMs: this.intervalMs }, "[EmailWorker] Starting email inbound worker");

        // Primeira execução com delay de 10s para esperar que a BD estabilize
        this.timer = setTimeout(() => this.runLoop(), 10_000);
    }

    /**
     * Para o worker de forma graceful.
     */
    stop(): void {
        this.isStopped = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        logger.info("[EmailWorker] Worker stopped");
    }

    /**
     * Loop principal: executa tick() e agenda o próximo.
     */
    private async runLoop(): Promise<void> {
        if (this.isStopped) return;

        this.isRunning = true;

        try {
            await this.tick();
        } catch (err) {
            // Erro fatal inesperado no tick — logar mas NÃO parar o worker
            logger.error({ err }, "[EmailWorker] Fatal error in tick cycle");
        }

        this.isRunning = false;

        // Agendar próxima execução (se não foi parado entretanto)
        if (!this.isStopped) {
            this.timer = setTimeout(() => this.runLoop(), this.intervalMs);
        }
    }

    /**
     * Um ciclo completo de polling.
     * Busca todos os canais, para cada um busca emails novos e processa.
     */
    private async tick(): Promise<void> {
        let channels: EmailChannel[];

        try {
            channels = await getActiveEmailChannels();
        } catch (err) {
            logger.error({ err }, "[EmailWorker] Failed to fetch active channels");
            return;
        }

        if (channels.length === 0) {
            logger.debug("[EmailWorker] No active email channels — skipping cycle");
            return;
        }

        logger.debug({ channelCount: channels.length }, "[EmailWorker] Starting poll cycle");

        // Processar cada canal sequencialmente (para não sobrecarregar a BD)
        for (const channel of channels) {
            if (this.isStopped) break;

            try {
                await this.processChannel(channel);
            } catch (err) {
                // Erro num canal não deve impedir o processamento dos outros
                logger.error(
                    { err, channelId: channel.EmailChannelId, email: channel.EmailAddress },
                    "[EmailWorker] Error processing channel"
                );
                await updateChannelSyncStatus(channel.EmailChannelId, false, String(err));
            }
        }
    }

    /**
     * Processa um canal de email: busca emails novos e processa cada um.
     */
    private async processChannel(channel: EmailChannel): Promise<void> {
        // Buscar configurações de entrada
        const inboundSettings = await getInboundSettings(channel.EmailChannelId);
        if (!inboundSettings) {
            logger.warn(
                { channelId: channel.EmailChannelId },
                "[EmailWorker] Channel has no inbound settings — skipping"
            );
            return;
        }

        // Desencriptar a password para passar ao provider
        const decryptedSettings = { ...inboundSettings };
        if (inboundSettings.EncryptedPassword) {
            try {
                decryptedSettings.EncryptedPassword = decrypt(inboundSettings.EncryptedPassword);
            } catch (err) {
                logger.error(
                    { err, channelId: channel.EmailChannelId },
                    "[EmailWorker] Failed to decrypt inbound password"
                );
                await updateChannelSyncStatus(channel.EmailChannelId, false, "Failed to decrypt credentials");
                return;
            }
        }

        // Resolver o provider correcto (IMAP, Gmail API, etc.)
        const provider = createInboundProvider(channel.ProviderType);

        // Buscar emails novos
        const rawMessages = await provider.fetchNewMessages(channel, decryptedSettings);

        if (rawMessages.length === 0) {
            // Sync bem-sucedida mas sem emails novos
            await updateChannelSyncStatus(channel.EmailChannelId, true);
            return;
        }

        logger.info(
            { channelId: channel.EmailChannelId, count: rawMessages.length },
            "[EmailWorker] Processing new messages"
        );

        // Processar cada email
        let lastUid: string | null = null;

        for (const raw of rawMessages) {
            if (this.isStopped) break;

            try {
                await this.processMessage(raw, channel);
                lastUid = raw.uid; // Atualizar o último UID processado com sucesso
            } catch (err) {
                logger.error(
                    { err, uid: raw.uid, channelId: channel.EmailChannelId },
                    "[EmailWorker] Error processing message"
                );
                // Continuar com a próxima mensagem — não parar por uma falha isolada
            }
        }

        // Atualizar o último UID processado e o status de sync
        if (lastUid) {
            await updateLastProcessedUid(channel.EmailChannelId, lastUid);
        }
        await updateChannelSyncStatus(channel.EmailChannelId, true);
    }

    /**
     * Processa uma única mensagem de email.
     * Este é o pipeline completo: normalizar → deduplicar → correlacionar → criar/append.
     */
    private async processMessage(raw: RawEmailMessage, channel: EmailChannel): Promise<void> {
        // 1. Normalizar a mensagem bruta
        const normalizedEvent = normalizeRawEmail(raw, channel);

        // 2. Verificar duplicação (pelo Message-ID header)
        if (normalizedEvent.MessageIdHeader) {
            const isDuplicate = await isEmailAlreadyProcessed(
                channel.TenantId,
                normalizedEvent.MessageIdHeader
            );
            if (isDuplicate) {
                logger.debug(
                    { messageId: normalizedEvent.MessageIdHeader, channelId: channel.EmailChannelId },
                    "[EmailWorker] Duplicate message — skipping"
                );
                return;
            }
        }

        // 3. Salvar o inbound event na BD (status: pending)
        const eventId = await saveInboundEvent(normalizedEvent);

        try {
            // 4. Marcar como "processing"
            await updateEventStatus(eventId, "processing");

            // 5. Correr o motor de correlação
            const correlation = await correlateToTicket({
                ...normalizedEvent,
                EventId: eventId,
                ProcessingStatus: "processing",
                ErrorMessage: null,
                RetryCount: 0,
                ConversationId: null,
                MessageId: null,
                CreatedAt: new Date(),
                ProcessedAt: null,
            });

            let conversationId: string;

            if (correlation.conversationId) {
                // ===============================================================
                // CORRELAÇÃO ENCONTRADA — Adicionar mensagem ao ticket existente
                // ===============================================================
                conversationId = correlation.conversationId;

                // Converter para o formato NormalizedInbound existente para reutilizar saveInboundMessage
                const inbound = this.toNormalizedInbound(normalizedEvent, channel);
                const messageId = await saveInboundMessage(inbound, conversationId);

                // Marcar evento como processado
                await updateEventStatus(eventId, "processed", { conversationId, messageId });

                logger.info(
                    { eventId, conversationId, level: correlation.level, subject: normalizedEvent.Subject },
                    "[EmailWorker] Message appended to existing conversation"
                );
            } else {
                // ===============================================================
                // SEM CORRELAÇÃO — Criar nova conversa + ticket
                // ===============================================================
                // Converter para NormalizedInbound para reutilizar a lógica existente
                const inbound = this.toNormalizedInbound(normalizedEvent, channel);

                // Precisamos de um connectorId para o ExternalThreadMap.
                // Vamos criar/buscar um connector genérico de email para este canal.
                const { connectorId, channelId } = await this.ensureEmailConnector(channel);

                logger.info({ connectorId, channelId }, "[EmailWorker] Resolving conversation for inbound");

                // Usar o serviço existente de resolveConversation (que cria conversa + ExternalThreadMap)
                conversationId = await resolveConversationForInbound(inbound, connectorId, channelId);

                // Salvar a mensagem na conversa
                const messageId = await saveInboundMessage(inbound, conversationId);

                // Criar ticket automaticamente
                await createTicketForConversation(channel.TenantId, conversationId);

                // Marcar evento como processado
                await updateEventStatus(eventId, "processed", { conversationId, messageId });

                logger.info(
                    { eventId, conversationId, subject: normalizedEvent.Subject, from: normalizedEvent.FromAddress },
                    "[EmailWorker] New conversation + ticket created from email"
                );
            }

            // 6. Salvar metadados de threading (CRUCIAL para correlação futura!)
            if (normalizedEvent.MessageIdHeader) {
                await saveEmailMessageMeta({
                    TenantId: channel.TenantId,
                    ConversationId: conversationId,
                    MessageId: null, // O MessageId da tabela Message (não temos aqui, mas está no InboundEvent)
                    EmailChannelId: channel.EmailChannelId,
                    EmailMessageIdHeader: normalizedEvent.MessageIdHeader,
                    InReplyTo: normalizedEvent.InReplyTo,
                    ReferencesHeader: normalizedEvent.ReferencesHeader,
                    Direction: "IN",
                });
            }

            // 7. Emitir evento Socket.IO para atualizar o frontend em tempo real
            this.emitNewMessageEvent(channel.TenantId, conversationId, normalizedEvent);

        } catch (err) {
            // Se falhar no processamento, marcar o evento como failed
            await updateEventStatus(eventId, "failed", {
                errorMessage: err instanceof Error ? err.message : String(err),
            });
            throw err; // Re-throw para o processChannel logar o erro
        }
    }

    /**
     * Converte um normalizedEvent para o formato NormalizedInbound existente.
     * Isto permite reutilizar as funções de conversation.ts sem alterações.
     */
    private toNormalizedInbound(
        event: ReturnType<typeof normalizeRawEmail>,
        channel: EmailChannel
    ): NormalizedInbound {
        return {
            tenantId: channel.TenantId,
            channel: "EMAIL",
            provider: "SMTP",
            externalChatId: event.FromAddress,    // Agrupamos por email do remetente
            externalUserId: event.FromAddress,
            externalMessageId: event.MessageIdHeader || undefined,
            senderName: event.FromName || event.FromAddress,
            subject: event.Subject || undefined,
            text: event.BodyText || event.BodyHtml?.replace(/<[^>]*>?/gm, "") || "",
            inReplyTo: event.InReplyTo || undefined,
            references: event.ReferencesHeader || undefined,
            timestamp: Date.now(),
            raw: {
                subject: event.Subject,
                from: event.FromAddress,
                to: event.ToAddress,
                messageId: event.MessageIdHeader,
                inReplyTo: event.InReplyTo,
                references: event.ReferencesHeader,
            },
        };
    }

    /**
     * Garante que existe um ChannelConnector de email para este EmailChannel.
     * Necessário para o ExternalThreadMap funcionar.
     */
    private async ensureEmailConnector(channel: EmailChannel): Promise<{ connectorId: string; channelId: string }> {
        const { getPool } = await import("../db.js");
        const pool = await getPool();

        // Criar um novo connector ID de forma determinística baseado no EmailChannelId
        const connectorId = `email-${channel.EmailChannelId.slice(0, 8)}`;

        // Verificar se JÁ EXISTE este connector específico na base de dados
        const existing = await pool.request()
            .input("connectorId", connectorId)
            .query(`
                SELECT TOP 1 ConnectorId, ChannelId FROM altdesk.ChannelConnector
                WHERE ConnectorId = @connectorId
            `);

        if (existing.recordset.length > 0) {
            return {
                connectorId: existing.recordset[0].ConnectorId,
                channelId: existing.recordset[0].ChannelId
            };
        }

        // Se não existe, precisamos de associar a um "Channel" de tipo EMAIL
        let altdeskChannelId: string;
        const channelCheck = await pool.request()
            .input("tenantId", channel.TenantId)
            .query(`
                SELECT TOP 1 ChannelId FROM altdesk.Channel
                WHERE TenantId = @tenantId AND Type = 'EMAIL' AND IsActive = 1 AND DeletedAt IS NULL
            `);

        if (channelCheck.recordset.length > 0) {
            altdeskChannelId = channelCheck.recordset[0].ChannelId;
        } else {
            // Criar o Channel de EMAIL caso não exista para este tenant
            const newChannel = await pool.request()
                .input("tenantId", channel.TenantId)
                .input("name", `Canais de Email`)
                .query(`
                    INSERT INTO altdesk.Channel (TenantId, Type, Name)
                    OUTPUT inserted.ChannelId
                    VALUES (@tenantId, 'EMAIL', @name)
                `);
            altdeskChannelId = newChannel.recordset[0].ChannelId;
        }

        // Agora sim, criar o connector com o ID determinístico
        await pool.request()
            .input("connectorId", connectorId)
            .input("channelId", altdeskChannelId)
            .input("configJson", JSON.stringify({ emailChannelId: channel.EmailChannelId }))
            .query(`
                INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson)
                VALUES (@connectorId, @channelId, 'SMTP', @configJson)
            `);

        logger.info(
            { connectorId, emailChannelId: channel.EmailChannelId },
            "[EmailWorker] Created email connector"
        );

        return { connectorId, channelId: altdeskChannelId };
    }

    /**
     * Emite evento Socket.IO para atualizar o frontend em tempo real.
     */
    private async emitNewMessageEvent(
        tenantId: string,
        conversationId: string,
        event: ReturnType<typeof normalizeRawEmail>
    ): Promise<void> {
        if (!ioInstance) return;

        try {
            const { emitConversationEvent } = await import("./socketService.js");

            emitConversationEvent(ioInstance, tenantId, conversationId, "message:new", {
                conversationId,
                senderExternalId: event.FromAddress,
                text: event.BodyText || "[Email]",
                direction: "IN",
                CreatedAt: new Date().toISOString(),
            });

            emitConversationEvent(ioInstance, tenantId, conversationId, "conversation:updated", {
                conversationId,
                lastMessage: event.Subject || event.BodyText?.slice(0, 100) || "[Email]",
                direction: "IN",
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            logger.error({ err, conversationId }, "[EmailWorker] Failed to emit socket event");
        }
    }
}

// ============================================================================
// Singleton e função de arranque
// ============================================================================

let workerInstance: EmailInboundWorker | null = null;

/**
 * Inicia o worker de email (deve ser chamado no index.ts).
 * 
 * @param intervalMs - Intervalo de polling em ms (default: 60000 = 60s)
 */
export function startEmailWorker(intervalMs: number = 60_000): void {
    if (workerInstance) {
        logger.warn("[EmailWorker] Worker already started");
        return;
    }

    workerInstance = new EmailInboundWorker(intervalMs);
    workerInstance.start();
}

/**
 * Para o worker de email (chamado no shutdown graceful).
 */
export function stopEmailWorker(): void {
    if (workerInstance) {
        workerInstance.stop();
        workerInstance = null;
    }
}
