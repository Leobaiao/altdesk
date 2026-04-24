import { ChannelAdapter, NormalizedInbound } from "./types.js";
import { Connector } from "../types/index.js";
import { sendEmail } from "../services/emailService.js";
import { logger } from "../lib/logger.js";

export class EmailAdapter implements ChannelAdapter {
    provider = "SMTP" as const;

    /**
     * Parseia o inbound vindo de um Webhook de Email (ex: SendGrid Inbound Parse)
     */
    parseInbound(body: any, connector: Connector): NormalizedInbound | null {
        const from = body.from;
        const to = body.to;
        const subject = body.subject;
        const text = body.text;
        const html = body.html;
        const messageId = body.headers?.['Message-ID'] || body.messageId;

        if (!from || !to) {
            logger.warn({ body }, "[EmailAdapter] Inbound inválido: faltando from/to");
            return null;
        }

        // Extrair apenas o e-mail do campo from
        const emailMatch = from.match(/<(.+)>|(\S+@\S+)/);
        const externalUserId = emailMatch ? (emailMatch[1] || emailMatch[2]) : from;

        return {
            tenantId: (connector as any).TenantId || "",
            channel: "EMAIL",
            provider: "SMTP",
            externalChatId: externalUserId,
            externalUserId: externalUserId,
            externalMessageId: messageId,
            senderName: from.split('<')[0].trim() || externalUserId,
            subject: subject,
            text: text || html?.replace(/<[^>]*>?/gm, '') || "",
            timestamp: Date.now(),
            raw: body
        };
    }

    async sendText(connector: Connector, to: string, text: string, options?: { inReplyTo?: string, subject?: string }): Promise<string | undefined> {
        try {
            const config = typeof connector.ConfigJson === 'string' 
                ? JSON.parse(connector.ConfigJson) 
                : connector.ConfigJson;

            let emailSubject = config.defaultSubject || "Re: Atendimento AltDesk";
            if (options?.subject) {
                const cleanSubject = options.subject.replace(/^(Re:\s*)+/i, '');
                emailSubject = `Re: ${cleanSubject}`;
            }

            const result = await sendEmail({
                to,
                subject: emailSubject,
                html: text,
                inReplyTo: options?.inReplyTo,
                references: options?.inReplyTo,
                config: {
                    host: config.host,
                    port: config.port,
                    secure: config.secure,
                    user: config.user,
                    pass: config.pass,
                    from: config.from
                }
            });

            return result.messageId;
        } catch (error) {
            logger.error({ error, connectorId: connector.ConnectorId }, "[EmailAdapter] Falha ao enviar e-mail");
            throw error;
        }
    }
}
