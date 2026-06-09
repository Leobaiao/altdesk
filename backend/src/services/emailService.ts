import nodemailer from "nodemailer";
import { logger } from "../lib/logger.js";

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
                // Garantir que o Message-ID seja rastreável se necessário
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

export async function sendPasswordResetEmail(to: string, resetLink: string) {
    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">Recuperação de Senha - AltDesk</h2>
            <p>Olá,</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no AltDesk.</p>
            <p>Clique no botão abaixo para escolher uma nova senha:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Redefinir Minha Senha</a>
            </div>
            <p>Se você não solicitou isso, pode ignorar este email com segurança.</p>
            <p>Este link expira em 1 hora.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;">
            <p style="font-size: 12px; color: #999;">Equipe AltDesk</p>
        </div>
    `;
    return sendEmail({ to, subject: "Recuperação de Senha - AltDesk", html });
}
