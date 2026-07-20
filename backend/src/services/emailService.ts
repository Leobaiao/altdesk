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
        let from = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"AltDesk" <${process.env.SMTP_USER}>` : '"AltDesk" <noreply@altdesk.com>');

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
        <div style="background-color: #f8fafc; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                <!-- Header -->
                <div style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
                    <img src="https://app.altdesk.com.br/logo-horizontal.png" alt="AltDesk" style="height: 38px; width: auto; display: block; margin: 0 auto;" />
                </div>
                <!-- Content -->
                <div style="padding: 40px 32px; text-align: center;">
                    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Recuperação de Senha</h2>
                    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                        Olá,<br><br>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>AltDesk</strong>.
                    </p>
                    
                    <div style="margin: 32px 0;">
                        <a href="${resetLink}" style="display: inline-block; background-color: #00a884; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
                            Redefinir Minha Senha
                        </a>
                    </div>
                    
                    <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                        Este link expira em <strong>1 hora</strong>.
                    </p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                        Se você não fez esta solicitação, pode ignorar este e-mail com segurança.
                    </p>
                </div>
                <!-- Footer -->
                <div style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600;">Equipe AltDesk</p>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">Mensagem automática de segurança. Não responda.</p>
                </div>
            </div>
        </div>
    `;
    return sendEmail({ to, subject: "Recuperação de Senha - AltDesk", html });
}

