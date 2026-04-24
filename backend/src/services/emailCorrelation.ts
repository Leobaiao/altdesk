/**
 * ============================================================================
 * AltDesk — Motor de Correlação de Email (Threading Engine)
 * ============================================================================
 * 
 * A LÓGICA DE NEGÓCIO MAIS CRÍTICA do módulo de email.
 * 
 * Problema que resolve:
 * Quando chega um email novo, precisamos saber se ele pertence a uma conversa
 * existente (ticket aberto) ou se é um email totalmente novo (criar ticket).
 * 
 * A correlação é feita em 4 níveis, ordenados da mais fiável para a menos fiável:
 * 
 *   Nível 1: In-Reply-To header → busca na tabela email_messages
 *            O cliente respondeu a um email nosso? O In-Reply-To contém o Message-ID
 *            do nosso email anterior. Procuramos esse ID na tabela.
 *            CONFIANÇA: ★★★★★ (100% — é uma referência directa)
 * 
 *   Nível 2: References header → busca na tabela email_messages
 *            Alguns clientes de email (especialmente web-based) alteram o In-Reply-To
 *            mas mantêm os References intactos. Tentamos cada Message-ID da lista.
 *            CONFIANÇA: ★★★★☆ (alta — mas pode ter falsos positivos em threads longas)
 * 
 *   Nível 3: [TCK-XXXXXXXX] no assunto
 *            O nosso sistema inclui o ticket code no assunto das respostas.
 *            Se o cliente manteve o assunto, extraímos o código e buscamos o ticket.
 *            CONFIANÇA: ★★★☆☆ (média — o cliente pode ter alterado o assunto)
 * 
 *   Nível 4: Remetente + conversa aberta recente
 *            Último recurso: se o mesmo email tem uma conversa aberta recente,
 *            assume que pertence a essa conversa.
 *            CONFIANÇA: ★★☆☆☆ (baixa — pode correlacionar erroneamente)
 * 
 * Se nenhum nível encontrar correspondência → retorna null → criar novo ticket.
 */

import { getPool } from "../db.js";
import { logger } from "../lib/logger.js";
import {
    findConversationByEmailMessageId,
    findConversationByReferences,
} from "./emailRepository.js";
import { extractTicketCode, parseReferences } from "./emailNormalizer.js";
import type { EmailInboundEvent } from "../types/emailTypes.js";

/**
 * Resultado da correlação.
 * - conversationId: o ID da conversa encontrada (null se é email novo)
 * - level: qual nível de correlação encontrou a match (para logs/debug)
 * - ticketId: o ID do ticket associado (se aplicável)
 */
export interface CorrelationResult {
    conversationId: string | null;
    ticketId: string | null;
    level: "in-reply-to" | "references" | "ticket-code" | "sender-fallback" | "none";
}

/**
 * Motor de correlação principal.
 * Recebe um InboundEvent e tenta encontrar a conversa/ticket existente.
 * 
 * @param event - O email normalizado (já na tabela EmailInboundEvent)
 * @returns CorrelationResult com a conversa encontrada ou null
 */
export async function correlateToTicket(event: EmailInboundEvent): Promise<CorrelationResult> {
    const tenantId = event.TenantId;

    // =========================================================================
    // NÍVEL 1: In-Reply-To → busca na tabela EmailMessageMeta
    // =========================================================================
    // Este é o caso mais comum e mais fiável.
    // Quando o cliente clica "Reply", o email dele tem In-Reply-To: <message-id-anterior>
    if (event.InReplyTo) {
        const conversationId = await findConversationByEmailMessageId(tenantId, event.InReplyTo);
        if (conversationId) {
            const ticketId = await findActiveTicketForConversation(tenantId, conversationId);
            logger.info(
                { eventId: event.EventId, conversationId, level: "in-reply-to", inReplyTo: event.InReplyTo },
                "[Correlation] Match found via In-Reply-To"
            );
            return { conversationId, ticketId, level: "in-reply-to" };
        }
    }

    // =========================================================================
    // NÍVEL 2: References → busca na tabela EmailMessageMeta
    // =========================================================================
    // O header References contém toda a cadeia de Message-IDs da thread.
    // Tentamos do mais recente (último) para o mais antigo (primeiro).
    if (event.ReferencesHeader) {
        const refs = parseReferences(event.ReferencesHeader);
        if (refs.length > 0) {
            const conversationId = await findConversationByReferences(tenantId, refs);
            if (conversationId) {
                const ticketId = await findActiveTicketForConversation(tenantId, conversationId);
                logger.info(
                    { eventId: event.EventId, conversationId, level: "references", refCount: refs.length },
                    "[Correlation] Match found via References"
                );
                return { conversationId, ticketId, level: "references" };
            }
        }
    }

    // =========================================================================
    // NÍVEL 3: [TCK-XXXXXXXX] no assunto
    // =========================================================================
    // O Altdesk inclui o ticket code no assunto das respostas.
    // Se o cliente respondeu mantendo o assunto, extraímos o código.
    if (event.Subject) {
        const ticketCode = extractTicketCode(event.Subject);
        if (ticketCode) {
            const result = await findConversationByTicketCode(tenantId, ticketCode);
            if (result) {
                logger.info(
                    { eventId: event.EventId, conversationId: result.conversationId, ticketId: result.ticketId, level: "ticket-code", code: ticketCode },
                    "[Correlation] Match found via ticket code in subject"
                );
                return { ...result, level: "ticket-code" };
            }
        }
    }

    // =========================================================================
    // NÍVEL 4: Remetente + conversa aberta recente (último recurso)
    // =========================================================================
    // Se o mesmo remetente tem uma conversa aberta (não RESOLVED) nas últimas 72h,
    // assumimos que este email pertence a essa conversa.
    // ⚠️ Isto pode gerar falsos positivos se o cliente abrir dois assuntos diferentes!
    {
        const result = await findRecentOpenConversation(tenantId, event.FromAddress);
        if (result) {
            logger.info(
                { eventId: event.EventId, conversationId: result.conversationId, level: "sender-fallback", sender: event.FromAddress },
                "[Correlation] Match found via sender fallback (low confidence)"
            );
            return { conversationId: result.conversationId, ticketId: result.ticketId, level: "sender-fallback" };
        }
    }

    // =========================================================================
    // NENHUM MATCH — email novo, criar ticket
    // =========================================================================
    logger.info(
        { eventId: event.EventId, from: event.FromAddress, subject: event.Subject },
        "[Correlation] No match found — will create new ticket"
    );
    return { conversationId: null, ticketId: null, level: "none" };
}

// ============================================================================
// Funções auxiliares de lookup na BD
// ============================================================================

/**
 * Busca o ticket ativo de uma conversa.
 */
async function findActiveTicketForConversation(tenantId: string, conversationId: string): Promise<string | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("conversationId", conversationId)
        .query(`
            SELECT TOP 1 TicketId FROM altdesk.Ticket
            WHERE TenantId = @tenantId 
              AND ConversationId = @conversationId 
              AND Status != 'CLOSED' 
              AND DeletedAt IS NULL
            ORDER BY CreatedAt DESC
        `);

    return result.recordset[0]?.TicketId || null;
}

/**
 * Busca uma conversa pelo ticket code (primeiros 8 chars do UUID do ticket).
 * 
 * O ticket code é derivado do TicketId: TicketId.split('-')[0].toUpperCase()
 * No assunto aparece como [TCK-A1B2C3D4]
 */
async function findConversationByTicketCode(
    tenantId: string,
    ticketCode: string
): Promise<{ conversationId: string; ticketId: string } | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("ticketCode", ticketCode + "%") // Busca por prefixo do UUID
        .query(`
            SELECT TOP 1 t.TicketId, t.ConversationId 
            FROM altdesk.Ticket t
            WHERE t.TenantId = @tenantId 
              AND UPPER(CAST(t.TicketId AS NVARCHAR(100))) LIKE @ticketCode
              AND t.DeletedAt IS NULL
            ORDER BY t.CreatedAt DESC
        `);

    if (result.recordset.length === 0) return null;

    return {
        conversationId: result.recordset[0].ConversationId,
        ticketId: result.recordset[0].TicketId,
    };
}

/**
 * Busca uma conversa aberta recente do mesmo remetente (últimas 72 horas).
 * 
 * ⚠️ Este é o fallback de menor confiança. Usado apenas quando todos os
 * outros métodos de correlação falharam.
 */
async function findRecentOpenConversation(
    tenantId: string,
    fromAddress: string
): Promise<{ conversationId: string; ticketId: string | null } | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("fromAddress", fromAddress.toLowerCase())
        .query(`
            SELECT TOP 1 c.ConversationId, t.TicketId
            FROM altdesk.Conversation c
            LEFT JOIN altdesk.Ticket t ON t.ConversationId = c.ConversationId 
                AND t.TenantId = @tenantId AND t.Status != 'CLOSED' AND t.DeletedAt IS NULL
            JOIN altdesk.ExternalThreadMap etm ON etm.ConversationId = c.ConversationId
            WHERE c.TenantId = @tenantId
              AND c.Status != 'RESOLVED'
              AND c.DeletedAt IS NULL
              AND LOWER(etm.ExternalUserId) = @fromAddress
              AND c.LastMessageAt >= DATEADD(hour, -72, SYSUTCDATETIME())
            ORDER BY c.LastMessageAt DESC
        `);

    if (result.recordset.length === 0) return null;

    return {
        conversationId: result.recordset[0].ConversationId,
        ticketId: result.recordset[0].TicketId || null,
    };
}
