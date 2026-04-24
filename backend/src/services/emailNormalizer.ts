/**
 * ============================================================================
 * AltDesk — Email Normalizer
 * ============================================================================
 * 
 * Converte uma mensagem bruta do provider (RawEmailMessage) num InboundEvent
 * pronto para processamento.
 * 
 * Responsabilidades:
 * - Limpar e normalizar endereços de email
 * - Limpar o assunto (remover prefixos Re:/Fwd:)
 * - Extrair headers de threading
 * - Preparar o JSON de attachments
 * - Gerar o RawHeadersJson para debug
 */

import type { RawEmailMessage, EmailInboundEvent, EmailChannel } from "../types/emailTypes.js";

/**
 * Limpa o histórico de respostas citadas (quotes) do corpo de texto do email.
 */
export function stripQuotedReply(text: string | null | undefined): string | null {
    if (!text) return null;

    const quoteMarkers = [
        /^[_\-]{2,}\s*Forwarded message\s*[_\-]{2,}$/mi,
        /^[_\-]{2,}\s*Mensagem encaminhada\s*[_\-]{2,}$/mi,
        /^[_\-]{2,}\s*Original Message\s*[_\-]{2,}$/mi,
        /^[_\-]{2,}\s*Mensagem Original\s*[_\-]{2,}$/mi,
        /^On\s+.+?wrote:\s*$/mi,
        /^Em\s+.+?escreveu:\s*$/mi,
        /^\s*De:\s*.+?<.+?@.+?>/mi, // Outlook BR (De: Nome <email>)
        /^\s*From:\s*.+?<.+?@.+?>/mi // Outlook EN (From: Name <email>)
    ];

    let lines = text.split(/\r?\n/);
    let cutoffIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (quoteMarkers.some(marker => marker.test(line))) {
            cutoffIndex = i;
            break;
        }
    }

    // Remove empty lines right before the cutoff
    while (cutoffIndex > 0 && lines[cutoffIndex - 1].trim() === '') {
        cutoffIndex--;
    }

    const cleaned = lines.slice(0, cutoffIndex).join('\n').trim();
    // Fallback para o texto original se por engano removermos tudo (não deveria acontecer)
    return cleaned.length > 0 ? cleaned : text.trim();
}

export function normalizeRawEmail(
    raw: RawEmailMessage,
    channel: EmailChannel
): Omit<EmailInboundEvent, 'EventId' | 'ProcessingStatus' | 'ErrorMessage' | 'RetryCount' | 'ConversationId' | 'MessageId' | 'CreatedAt' | 'ProcessedAt'> {
    return {
        EmailChannelId: channel.EmailChannelId,
        TenantId: channel.TenantId,

        MessageIdHeader: raw.messageId ? cleanMessageId(raw.messageId) : null,
        InReplyTo: raw.inReplyTo ? cleanMessageId(raw.inReplyTo) : null,
        ReferencesHeader: raw.references || null,

        FromAddress: raw.from.address.toLowerCase().trim(),
        FromName: raw.from.name || null,
        ToAddress: raw.to.map(a => a.address).join(", "),
        Subject: raw.subject,
        BodyText: stripQuotedReply(raw.textBody) || "",
        BodyHtml: raw.htmlBody,

        AttachmentsJson: raw.attachments.length > 0
            ? JSON.stringify(raw.attachments)
            : null,

        RawHeadersJson: JSON.stringify(raw.rawHeaders).slice(0, 4000),
    };
}

/**
 * Limpa o assunto de um email, removendo prefixos de resposta e reencaminhamento.
 * Usado pelo motor de correlação para comparar assuntos.
 * 
 * @example
 * cleanSubject("Re: Fwd: Re: Problema com fatura")
 * // → "Problema com fatura"
 */
export function cleanSubject(subject: string): string {
    // Remove múltiplos prefixos Re:, Fwd:, Enc: (português), Fw:
    return subject
        .replace(/^(Re|Fwd|Fw|Enc):\s*/gi, "")
        .replace(/^(Re|Fwd|Fw|Enc):\s*/gi, "") // Segunda passada para nested (Re: Fwd: ...)
        .replace(/^(Re|Fwd|Fw|Enc):\s*/gi, "") // Terceira passada
        .trim();
}

/**
 * Extrai o ticket code do assunto, se existir.
 * Procura pelo padrão [TCK-XXXXXXXX] onde X é hexadecimal (primeiros 8 chars do UUID).
 * 
 * @example
 * extractTicketCode("Re: [TCK-A1B2C3D4] Problema com fatura")
 * // → "A1B2C3D4"
 * 
 * extractTicketCode("Preciso de ajuda")
 * // → null
 */
export function extractTicketCode(subject: string): string | null {
    // Padrão: [TCK-XXXXXXXX] onde X pode ser alfanumérico (parte do UUID)
    const match = subject.match(/\[TCK-([A-Za-z0-9]+)\]/i);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Gera o assunto para uma resposta do agente, incluindo o ticket code.
 * 
 * @param originalSubject - O assunto original do email do cliente
 * @param ticketId - O TicketId (UUID) do ticket
 * @returns O assunto formatado com o ticket code
 * 
 * @example
 * buildReplySubject("Problema com fatura", "a1b2c3d4-5678-...")
 * // → "Re: [TCK-A1B2C3D4] Problema com fatura"
 */
export function buildReplySubject(originalSubject: string, ticketId: string): string {
    const ticketCode = ticketId.split("-")[0].toUpperCase();
    const cleanedSubject = cleanSubject(originalSubject || "Atendimento");

    // Verificar se o ticket code já está no assunto (evitar duplicação)
    if (cleanedSubject.includes(`[TCK-${ticketCode}]`)) {
        return `Re: ${cleanedSubject}`;
    }

    return `Re: [TCK-${ticketCode}] ${cleanedSubject}`;
}

/**
 * Limpa um Message-ID, removendo espaços e garantindo o formato <...>.
 */
function cleanMessageId(messageId: string): string {
    let cleaned = messageId.trim();
    // Alguns servidores enviam sem os angle brackets
    if (!cleaned.startsWith("<")) cleaned = `<${cleaned}`;
    if (!cleaned.endsWith(">")) cleaned = `${cleaned}>`;
    return cleaned;
}

/**
 * Parse da lista de References header.
 * O header References contém Message-IDs separados por espaços.
 * 
 * @example
 * parseReferences("<abc@gmail.com> <def@gmail.com> <ghi@altdesk.com>")
 * // → ["<abc@gmail.com>", "<def@gmail.com>", "<ghi@altdesk.com>"]
 */
export function parseReferences(references: string | null): string[] {
    if (!references) return [];
    // Dividir por espaços ou newlines, filtrar vazios, limpar cada um
    return references
        .split(/[\s\r\n]+/)
        .filter(ref => ref.length > 0)
        .map(ref => cleanMessageId(ref));
}
