import nodemailer from "nodemailer";
import { logger } from "../lib/logger.js";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT) || 1025, // Default MailHog port if not set
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"AltDesk" <noreply@altdesk.com>',
            to,
            subject,
            html,
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
