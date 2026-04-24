/**
 * ============================================================================
 * AltDesk — SMTP Outbound Provider
 * ============================================================================
 * 
 * Provider que envia emails via SMTP usando nodemailer.
 * 
 * Responsabilidades:
 * - Construir o email com headers de threading corretos
 * - Configurar From, Reply-To segundo as settings do canal
 * - Retornar o Message-ID do email enviado (CRUCIAL para threading futuro)
 * 
 * ⚠️ O Message-ID retornado DEVE ser guardado na tabela email_messages.
 *    Sem isso, a próxima resposta do cliente não será correlacionada.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logger } from "../../lib/logger.js";
import type { OutboundEmailProvider } from "./types.js";
import type { EmailChannel, EmailOutboundSettings, OutboundEmailPayload } from "../../types/emailTypes.js";

export class SmtpOutboundProvider implements OutboundEmailProvider {

    /**
     * Envia um email via SMTP.
     * 
     * @returns O Message-ID do email enviado (ex: "<abc123@smtp.gmail.com>")
     */
    async sendEmail(
        channel: EmailChannel,
        settings: EmailOutboundSettings,
        payload: OutboundEmailPayload
    ): Promise<{ messageId: string }> {
        const password = settings.EncryptedPassword; // Já desencriptado pelo caller
        if (!settings.SmtpHost || !settings.Username || !password) {
            throw new Error(`[SMTP] Missing connection settings for channel ${channel.EmailChannelId}`);
        }

        const transporter = this.createTransporter(settings, password);

        // Construir o endereço "From"
        const fromName = payload.fromName || settings.FromName || channel.Name;
        const fromAddress = payload.fromAddress || settings.FromAddress || channel.EmailAddress;
        const from = `"${fromName}" <${fromAddress}>`;

        // Construir o endereço "Reply-To"
        const replyTo = payload.replyTo || settings.ReplyToAddress || fromAddress;

        try {
            const info = await transporter.sendMail({
                from,
                to: payload.to,
                replyTo,
                subject: payload.subject,
                html: payload.html,
                text: payload.text,

                // Headers de threading — são estes que fazem a "magia"
                // do email aparecer como resposta na thread do cliente
                inReplyTo: payload.inReplyTo,
                references: payload.references,

                // Header customizado para rastreio
                headers: {
                    "X-AltDesk-Channel": channel.EmailChannelId,
                    "X-Mailer": "AltDesk ServiceDesk",
                },
            });

            const messageId = info.messageId;
            logger.info(
                { channelId: channel.EmailChannelId, messageId, to: payload.to, subject: payload.subject },
                "[SMTP] Email sent successfully"
            );

            return { messageId };
        } catch (err) {
            logger.error(
                { err, channelId: channel.EmailChannelId, to: payload.to },
                "[SMTP] Failed to send email"
            );
            throw err;
        }
    }

    /**
     * Testa a conexão SMTP (verifica credenciais e conectividade).
     */
    async testConnection(channel: EmailChannel, settings: EmailOutboundSettings): Promise<boolean> {
        const password = settings.EncryptedPassword;
        if (!settings.SmtpHost || !settings.Username || !password) {
            throw new Error("Missing SMTP connection settings (host, username, or password)");
        }

        const transporter = this.createTransporter(settings, password);

        try {
            await transporter.verify();
            logger.info({ channelId: channel.EmailChannelId }, "[SMTP] Test connection successful");
            return true;
        } catch (err) {
            logger.error({ err, channelId: channel.EmailChannelId }, "[SMTP] Test connection failed");
            throw err;
        }
    }

    /**
     * Cria um transporter nodemailer com as settings do canal.
     */
    private createTransporter(settings: EmailOutboundSettings, password: string): Transporter {
        return nodemailer.createTransport({
            host: settings.SmtpHost!,
            port: settings.SmtpPort || 587,
            secure: settings.SmtpSecure === true, // true = TLS direto (465), false = STARTTLS (587)
            auth: {
                user: settings.Username!,
                pass: password,
            },
            // Timeouts para não bloquear o worker
            connectionTimeout: 10_000,  // 10s para conectar
            greetingTimeout: 10_000,    // 10s para greeting
            socketTimeout: 30_000,      // 30s para operações
        });
    }
}
