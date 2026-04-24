/**
 * ============================================================================
 * AltDesk — Provider Factory
 * ============================================================================
 * 
 * Padrão Factory que resolve o provider correto com base no tipo de canal.
 * 
 * Analogia (do guia do dev):
 * É como um adaptador de tomada universal. Independentemente do tipo de conta
 * (Gmail, Microsoft, IMAP genérico), o adaptador dá-te sempre a interface
 * que precisas — InboundEmailProvider ou OutboundEmailProvider.
 * 
 * No MVP, apenas IMAP/SMTP está implementado.
 * Gmail e Microsoft serão adicionados como providers adicionais no futuro.
 */

import type { EmailProviderType } from "../../types/emailTypes.js";
import type { InboundEmailProvider, OutboundEmailProvider } from "./types.js";
import { ImapInboundProvider } from "./imapProvider.js";
import { SmtpOutboundProvider } from "./smtpProvider.js";

// Singletons — não há estado nos providers, podemos reutilizar
const imapProvider = new ImapInboundProvider();
const smtpProvider = new SmtpOutboundProvider();

/**
 * Resolve o provider de entrada (leitura de emails) para o tipo de canal dado.
 * 
 * @param providerType - O tipo de provider do canal (imap_smtp, gmail, microsoft)
 * @returns Uma instância de InboundEmailProvider
 * @throws Error se o tipo não for suportado
 * 
 * @example
 * const provider = createInboundProvider('imap_smtp');
 * const messages = await provider.fetchNewMessages(channel, settings);
 */
export function createInboundProvider(providerType: EmailProviderType): InboundEmailProvider {
    switch (providerType) {
        case "imap_smtp":
            return imapProvider;

        case "gmail":
            // TODO: Implementar GmailInboundProvider (Gmail API + OAuth2)
            // Por agora, usa IMAP como fallback (Gmail suporta IMAP com App Passwords)
            throw new Error(
                "Gmail API provider not yet implemented. " +
                "Use 'imap_smtp' with Gmail IMAP settings and an App Password as a workaround."
            );

        case "microsoft":
            // TODO: Implementar MicrosoftInboundProvider (Microsoft Graph API + MSAL)
            throw new Error(
                "Microsoft Graph provider not yet implemented. " +
                "Use 'imap_smtp' with Outlook IMAP settings as a workaround."
            );

        default:
            throw new Error(`Unknown email provider type: '${providerType}'`);
    }
}

/**
 * Resolve o provider de saída (envio de emails) para o tipo de canal dado.
 * 
 * @param providerType - O tipo de provider do canal (imap_smtp, gmail, microsoft)
 * @returns Uma instância de OutboundEmailProvider
 * @throws Error se o tipo não for suportado
 * 
 * @example
 * const provider = createOutboundProvider('imap_smtp');
 * const { messageId } = await provider.sendEmail(channel, settings, payload);
 */
export function createOutboundProvider(providerType: EmailProviderType): OutboundEmailProvider {
    switch (providerType) {
        case "imap_smtp":
            return smtpProvider;

        case "gmail":
            // TODO: Implementar GmailOutboundProvider (Gmail API + OAuth2)
            throw new Error(
                "Gmail API outbound provider not yet implemented. " +
                "Use 'imap_smtp' with Gmail SMTP settings as a workaround."
            );

        case "microsoft":
            // TODO: Implementar MicrosoftOutboundProvider (Graph API + MSAL)
            throw new Error(
                "Microsoft Graph outbound provider not yet implemented. " +
                "Use 'imap_smtp' with Outlook SMTP settings as a workaround."
            );

        default:
            throw new Error(`Unknown email provider type: '${providerType}'`);
    }
}
