/**
 * ============================================================================
 * AltDesk — IMAP Inbound Provider
 * ============================================================================
 * 
 * Provider que conecta via IMAP para ler emails novos de uma caixa.
 * Usa a biblioteca `imapflow` (moderna, Promise-based, suporta IDLE).
 * 
 * Fluxo simplificado:
 * 1. Conecta ao servidor IMAP com credentials (desencriptadas pelo caller)
 * 2. Selecciona a pasta INBOX
 * 3. Busca mensagens com UID > lastProcessedUid (fetch incremental)
 * 4. Para cada mensagem, faz fetch dos headers e body
 * 5. Converte para RawEmailMessage
 * 6. Desconecta
 * 
 * ⚠️ IMPORTANTE: As passwords chegam aqui já ENCRIPTADAS no objeto settings.
 *    O caller (worker) deve usar decryptInboundPassword() antes de passar ao provider.
 *    Este provider recebe as credentials como parâmetro decifrado.
 */

import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { logger } from "../../lib/logger.js";
import type { InboundEmailProvider } from "./types.js";
import type { EmailChannel, EmailInboundSettings, RawEmailMessage, EmailAddress, EmailAttachment } from "../../types/emailTypes.js";

export class ImapInboundProvider implements InboundEmailProvider {

    /**
     * Conecta via IMAP e busca todas as mensagens novas (UID > lastProcessedUid).
     */
    async fetchNewMessages(channel: EmailChannel, settings: EmailInboundSettings): Promise<RawEmailMessage[]> {
        const password = settings.EncryptedPassword; // O caller já desencriptou e substituiu aqui
        if (!settings.ImapHost || !settings.Username || !password) {
            throw new Error(`[IMAP] Missing connection settings for channel ${channel.EmailChannelId}`);
        }

        const client = new ImapFlow({
            host: settings.ImapHost,
            port: settings.ImapPort || 993,
            secure: settings.ImapSecure !== false,
            auth: {
                user: settings.Username,
                pass: password,
            },
            logger: false, // Desativar logs internos do imapflow (usamos o nosso pino)
        });

        const messages: RawEmailMessage[] = [];

        try {
            await client.connect();
            logger.debug({ channelId: channel.EmailChannelId, host: settings.ImapHost }, "[IMAP] Connected");

            // Seleccionar INBOX (lock para operações atómicas)
            const lock = await client.getMailboxLock("INBOX");

            try {
                // Determinar o range de UIDs a buscar
                // Se temos lastProcessedUid, buscamos uid > lastProcessedUid
                // Se não, buscamos as últimas 50 mensagens (primeira sync)
                let searchCriteria: string;

                if (settings.LastProcessedUid) {
                    const nextUid = parseInt(settings.LastProcessedUid, 10) + 1;
                    searchCriteria = `${nextUid}:*`;
                } else {
                    // Primeira sync: buscar as últimas 50 mensagens para não sobrecarregar
                    searchCriteria = "*";
                }

                // Iterar sobre as mensagens que correspondem ao critério
                let count = 0;
                const maxMessages = settings.LastProcessedUid ? 100 : 50; // Limitar por ciclo

                for await (const msg of client.fetch(searchCriteria, {
                    uid: true,
                    envelope: true,
                    source: true, // Buscar o source completo para parsing com mailparser
                })) {
                    // Se é a primeira sync e recebemos muitas, limitar
                    if (count >= maxMessages) {
                        logger.info(
                            { channelId: channel.EmailChannelId, limit: maxMessages },
                            "[IMAP] Reached max messages per cycle, will continue next poll"
                        );
                        break;
                    }

                    // Ignorar mensagens com UID <= lastProcessedUid (o range pode incluir o próprio)
                    const uidStr = String(msg.uid);
                    if (settings.LastProcessedUid && msg.uid <= parseInt(settings.LastProcessedUid, 10)) {
                        continue;
                    }

                    try {
                        if (!msg.source) {
                            logger.warn({ uid: uidStr, channelId: channel.EmailChannelId }, "[IMAP] Message has no source — skipping");
                            continue;
                        }
                        const parsed: ParsedMail = await simpleParser(msg.source) as unknown as ParsedMail;
                        const rawMessage = this.convertToRawEmail(parsed, uidStr);
                        messages.push(rawMessage);
                        count++;
                    } catch (parseErr) {
                        logger.error(
                            { err: parseErr, uid: uidStr, channelId: channel.EmailChannelId },
                            "[IMAP] Failed to parse message"
                        );
                        // Não falhar tudo por uma mensagem mal-formada — continuar
                    }
                }

                logger.info(
                    { channelId: channel.EmailChannelId, fetched: messages.length },
                    "[IMAP] Fetch cycle complete"
                );
            } finally {
                lock.release();
            }
        } catch (err) {
            logger.error(
                { err, channelId: channel.EmailChannelId, host: settings.ImapHost },
                "[IMAP] Connection/fetch error"
            );
            throw err;
        } finally {
            // Sempre tentar desconectar, mesmo que dê erro
            try {
                await client.logout();
            } catch {
                // Ignorar erros de logout
            }
        }

        return messages;
    }

    /**
     * Testa a conexão IMAP (conecta e desconecta).
     */
    async testConnection(channel: EmailChannel, settings: EmailInboundSettings): Promise<boolean> {
        const password = settings.EncryptedPassword;
        if (!settings.ImapHost || !settings.Username || !password) {
            throw new Error("Missing IMAP connection settings (host, username, or password)");
        }

        const client = new ImapFlow({
            host: settings.ImapHost,
            port: settings.ImapPort || 993,
            secure: settings.ImapSecure !== false,
            auth: {
                user: settings.Username,
                pass: password,
            },
            logger: false,
        });

        try {
            await client.connect();
            // Verificar que INBOX existe e é acessível
            const mailbox = await client.mailboxOpen("INBOX");
            logger.info(
                { channelId: channel.EmailChannelId, exists: mailbox.exists },
                "[IMAP] Test connection successful"
            );
            await client.logout();
            return true;
        } catch (err) {
            logger.error({ err, channelId: channel.EmailChannelId }, "[IMAP] Test connection failed");
            try { await client.logout(); } catch { /* ignore */ }
            throw err;
        }
    }

    /**
     * Converte um email parseado pelo mailparser para o nosso formato RawEmailMessage.
     * 
     * Aqui é onde extraímos os headers críticos para threading:
     * - Message-ID: identificador único do email
     * - In-Reply-To: o Message-ID do email ao qual este é resposta
     * - References: toda a cadeia de Message-IDs da thread
     */
    private convertToRawEmail(parsed: ParsedMail, uid: string): RawEmailMessage {
        // Extrair endereços do formato do mailparser
        const fromAddr = parsed.from?.value?.[0];
        const toAddrs = parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [];
        const ccAddrs = parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [];

        const from: EmailAddress = {
            address: fromAddr?.address || "",
            name: fromAddr?.name || "",
        };

        const to: EmailAddress[] = toAddrs.flatMap(addr =>
            addr.value.map(v => ({ address: v.address || "", name: v.name || "" }))
        );

        const cc: EmailAddress[] = ccAddrs.flatMap(addr =>
            addr.value.map(v => ({ address: v.address || "", name: v.name || "" }))
        );

        // Extrair headers de threading
        const messageId = parsed.messageId || null;
        const inReplyTo = parsed.inReplyTo || null;

        // References pode ser string ou array
        let references: string | null = null;
        if (parsed.references) {
            references = Array.isArray(parsed.references)
                ? parsed.references.join(" ")
                : String(parsed.references);
        }

        // Extrair attachments (sem o conteúdo binário — apenas metadados)
        const attachments: EmailAttachment[] = (parsed.attachments || []).map(att => ({
            filename: att.filename || "unnamed",
            contentType: att.contentType || "application/octet-stream",
            size: att.size || 0,
            contentId: att.cid,
        }));

        // Construir mapa de headers raw para debug
        const rawHeaders: Record<string, string> = {};
        if (parsed.headers) {
            parsed.headers.forEach((value, key) => {
                rawHeaders[key] = typeof value === "string" ? value : JSON.stringify(value);
            });
        }

        return {
            uid,
            messageId,
            inReplyTo,
            references,
            from,
            to,
            cc,
            subject: parsed.subject || null,
            textBody: parsed.text || null,
            htmlBody: parsed.html || null,
            date: parsed.date || null,
            attachments,
            rawHeaders,
        };
    }
}
