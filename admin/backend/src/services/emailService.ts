import nodemailer from "nodemailer";
import { logger } from "../lib/logger.js";

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
    inReplyTo?: string;
    references?: string;
    config?: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
        from?: string;
    };
}

export async function sendEmail({ to, subject, html, text, inReplyTo, references, config }: EmailOptions) {
    try {
        const transporterConfig: any = {
            host: process.env.SMTP_HOST || "localhost",
            port: Number(process.env.SMTP_PORT) || 1025,
            secure: process.env.SMTP_SECURE === "true",
        };

        if (process.env.SMTP_USER) {
            transporterConfig.auth = {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            };
        }

        const defaultTransporter = nodemailer.createTransport(transporterConfig);

        let transporter = defaultTransporter;
        let from = process.env.SMTP_FROM || '"AltDesk" <noreply@altdesk.com>';

        if (config) {
            const configOptions: any = {
                host: config.host,
                port: config.port,
                secure: config.secure,
            };
            if (config.user) {
                configOptions.auth = {
                    user: config.user,
                    pass: config.pass,
                };
            }
            transporter = nodemailer.createTransport(configOptions);
            from = config.from || `"${config.user}" <${config.user}>`;
        }

        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
            text,
            inReplyTo,
            references,
            headers: {
                'X-AltDesk-Provider': 'ServiceDesk'
            }
        });

        logger.info({ messageId: info.messageId, to, subject }, "[Email] Sent successfully");
        return info;
    } catch (error) {
        logger.error({ error, to, subject }, "[Email] Failed to send");
        throw error;
    }
}
