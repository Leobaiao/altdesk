import { ChannelAdapter, NormalizedInbound } from "./types.js";
import { Connector } from "../types/index.js";
import { sendEmail } from "../services/emailService.js";
import { logger } from "../lib/logger.js";
import { getPool } from "../db.js";
import { decrypt, isEncrypted } from "../lib/encryption.js";

export class EmailAdapter implements ChannelAdapter {
    provider = "SMTP" as const;

    /**
     * Parsseia o inbound vindo de um Webhook de Email (ex: SendGrid Inbound Parse)
     */
    parseInbound(body: any, connector: Connector): NormalizedInbound | null {
        // Exemplo simplificado baseado no SendGrid Inbound Parse
        // https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
        
        const from = body.from; // "Name <email@example.com>"
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
            externalChatId: externalUserId, // Agrupamos por e-mail por padrão
            externalUserId: externalUserId,
            externalMessageId: messageId,
            senderName: from.split('<')[0].trim() || externalUserId,
            subject: subject,
            text: text || html?.replace(/<[^>]*>?/gm, '') || "", // Fallback simples para strip HTML
            timestamp: Date.now(),
            raw: body
        };
    }

    async sendText(connector: Connector, to: string, text: string, options?: { inReplyTo?: string, subject?: string }): Promise<string | undefined> {
        try {
            const config = typeof connector.ConfigJson === 'string' 
                ? JSON.parse(connector.ConfigJson || '{}') 
                : (connector.ConfigJson || {});

            let emailSubject = config.defaultSubject || "Re: Atendimento AltDesk";
            if (options?.subject) {
                const cleanSubject = options.subject.replace(/^(Re:\s*)+/i, '');
                emailSubject = `Re: ${cleanSubject}`;
            }

            let smtpConfig: any = undefined;

            // Buscar configurações SMTP da tabela EmailOutboundSettings usando o emailChannelId
            if (config.emailChannelId) {
                try {
                    const pool = await getPool();
                    const result = await pool.request()
                        .input("channelId", config.emailChannelId)
                        .query(`
                            SELECT SmtpHost, SmtpPort, SmtpSecure, Username, EncryptedPassword,
                                   FromName, FromAddress, ReplyToAddress
                            FROM altdesk.EmailOutboundSettings
                            WHERE EmailChannelId = @channelId
                        `);

                    if (result.recordset.length > 0) {
                        const settings = result.recordset[0];
                        
                        // Desencriptar password
                        let password = "";
                        if (settings.EncryptedPassword) {
                            try {
                                password = isEncrypted(settings.EncryptedPassword) 
                                    ? decrypt(settings.EncryptedPassword) 
                                    : settings.EncryptedPassword;
                            } catch (e) {
                                logger.error({ err: e }, "[EmailAdapter] Failed to decrypt outbound password");
                            }
                        }

                        smtpConfig = {
                            host: settings.SmtpHost,
                            port: settings.SmtpPort,
                            secure: !!settings.SmtpSecure,
                            user: settings.Username,
                            pass: password,
                            from: settings.FromAddress 
                                ? `"${settings.FromName || settings.Username}" <${settings.FromAddress}>`
                                : undefined
                        };

                        logger.info({ 
                            host: smtpConfig.host, 
                            port: smtpConfig.port,
                            user: smtpConfig.user,
                            hasPass: !!password 
                        }, "[EmailAdapter] SMTP config loaded from DB");
                    } else {
                        logger.warn({ emailChannelId: config.emailChannelId }, "[EmailAdapter] No outbound settings found");
                    }
                } catch (dbErr) {
                    logger.error({ err: dbErr, emailChannelId: config.emailChannelId }, "[EmailAdapter] Failed to load outbound settings from DB");
                }
            } else if (config.host) {
                // Fallback para o formato antigo (ConfigJson directo)
                smtpConfig = {
                    host: config.host,
                    port: config.port,
                    secure: config.secure,
                    user: config.user,
                    pass: config.pass,
                    from: config.from
                };
            }

            if (!smtpConfig) {
                throw new Error("No SMTP configuration found for this connector. Check EmailOutboundSettings.");
            }

            // Formatar texto para HTML preservando quebras de linha
            const formattedBody = text.replace(/\n/g, '<br/>');
            
            const htmlTemplate = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333; line-height: 1.6; max-width: 600px; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #ffffff;">
                    <div style="font-size: 14px;">
                        ${formattedBody}
                    </div>
                    <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
                    <div style="font-size: 12px; color: #888888; text-align: center;">
                        <p style="margin: 0;">Respondido através da plataforma <strong>AltDesk</strong></p>
                    </div>
                </div>
            `;

            const result = await sendEmail({
                to,
                subject: emailSubject,
                html: htmlTemplate,
                text: text, // Plain-text fallback verdadeiro
                inReplyTo: options?.inReplyTo,
                references: options?.inReplyTo,
                config: smtpConfig
            });

            return result.messageId;
        } catch (error) {
            logger.error({ error, connectorId: connector.ConnectorId }, "[EmailAdapter] Falha ao enviar e-mail");
            throw error;
        }
    }
}
