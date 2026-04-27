/**
 * ============================================================================
 * AltDesk — Email Channels API Routes
 * ============================================================================
 * 
 * Rotas para gestão de canais de email (CRUD + testes de conexão).
 * 
 * Endpoints:
 *   POST   /api/email-channels              — Criar canal de email
 *   GET    /api/email-channels              — Listar canais do tenant
 *   GET    /api/email-channels/:id          — Detalhes de um canal
 *   PUT    /api/email-channels/:id          — Atualizar canal
 *   DELETE /api/email-channels/:id          — Desativar canal
 *   POST   /api/email-channels/:id/test-inbound   — Testar conexão IMAP
 *   POST   /api/email-channels/:id/test-outbound  — Testar envio SMTP
 */

import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { authMw, requireRole } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { logger } from "../lib/logger.js";
import { decrypt } from "../lib/encryption.js";
import {
    getEmailChannelsByTenant,
    getEmailChannelById,
    createEmailChannel,
    updateEmailChannel,
    deleteEmailChannel,
    getInboundSettings,
    getOutboundSettings,
    upsertInboundSettings,
    upsertOutboundSettings,
} from "../services/emailRepository.js";
import { createInboundProvider, createOutboundProvider } from "../services/emailProviders/providerFactory.js";
import type { AuthenticatedRequest } from "../types/index.js";

const router = Router();
router.use(authMw);

// ============================================================================
// Schemas de validação (Zod)
// ============================================================================

const createChannelSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    emailAddress: z.string().email("Email inválido"),
    providerType: z.enum(["imap_smtp", "gmail", "microsoft"]).default("imap_smtp"),
    defaultQueueId: z.string().uuid().nullable().optional(),
    inbound: z.object({
        imapHost: z.string().min(1),
        imapPort: z.number().int().min(1).max(65535).default(993),
        imapSecure: z.boolean().default(true),
        username: z.string().min(1),
        password: z.string().min(1),
        pollIntervalSeconds: z.number().int().min(30).max(300).default(60),
    }).optional(),
    outbound: z.object({
        smtpHost: z.string().min(1),
        smtpPort: z.number().int().min(1).max(65535).default(587),
        smtpSecure: z.boolean().default(false),
        username: z.string().min(1),
        password: z.string().min(1),
        fromName: z.string().optional(),
        fromAddress: z.string().email().optional(),
        replyToAddress: z.string().email().optional(),
    }).optional(),
});

const updateChannelSchema = z.object({
    name: z.string().min(1).optional(),
    emailAddress: z.string().email().optional(),
    providerType: z.enum(["imap_smtp", "gmail", "microsoft"]).optional(),
    isActive: z.boolean().optional(),
    defaultQueueId: z.string().uuid().nullable().optional(),
    inbound: z.object({
        imapHost: z.string().min(1).optional(),
        imapPort: z.number().int().min(1).max(65535).optional(),
        imapSecure: z.boolean().optional(),
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        pollIntervalSeconds: z.number().int().min(30).max(300).optional(),
    }).optional(),
    outbound: z.object({
        smtpHost: z.string().min(1).optional(),
        smtpPort: z.number().int().min(1).max(65535).optional(),
        smtpSecure: z.boolean().optional(),
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        fromName: z.string().optional(),
        fromAddress: z.string().email().optional(),
        replyToAddress: z.string().email().optional(),
    }).optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/email-channels
 * Lista todos os canais de email do tenant.
 */
router.get("/", requireRole("ADMIN"), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) return res.status(400).json({ error: "TenantId required" });

        const channels = await getEmailChannelsByTenant(tenantId);

        // Adicionar informação de settings (sem expor passwords!)
        const result = await Promise.all(channels.map(async (ch) => {
            const inbound = await getInboundSettings(ch.EmailChannelId);
            const outbound = await getOutboundSettings(ch.EmailChannelId);

            return {
                ...ch,
                inbound: inbound ? {
                    protocol: inbound.Protocol,
                    imapHost: inbound.ImapHost,
                    imapPort: inbound.ImapPort,
                    imapSecure: inbound.ImapSecure,
                    username: inbound.Username,
                    hasPassword: !!inbound.EncryptedPassword,
                    pollIntervalSeconds: inbound.PollIntervalSeconds,
                    lastProcessedUid: inbound.LastProcessedUid,
                } : null,
                outbound: outbound ? {
                    protocol: outbound.Protocol,
                    smtpHost: outbound.SmtpHost,
                    smtpPort: outbound.SmtpPort,
                    smtpSecure: outbound.SmtpSecure,
                    username: outbound.Username,
                    hasPassword: !!outbound.EncryptedPassword,
                    fromName: outbound.FromName,
                    fromAddress: outbound.FromAddress,
                    replyToAddress: outbound.ReplyToAddress,
                } : null,
            };
        }));

        res.json(result);
    } catch (error) {
        next(error);
    }
}) as any);

/**
 * GET /api/email-channels/:id
 * Detalhes de um canal específico.
 */
router.get("/:id", requireRole("ADMIN"), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const channel = await getEmailChannelById(req.params.id);
        if (!channel || channel.TenantId !== req.user.tenantId) {
            return res.status(404).json({ error: "Canal não encontrado" });
        }

        const inbound = await getInboundSettings(channel.EmailChannelId);
        const outbound = await getOutboundSettings(channel.EmailChannelId);

        res.json({
            ...channel,
            inbound: inbound ? {
                protocol: inbound.Protocol,
                imapHost: inbound.ImapHost,
                imapPort: inbound.ImapPort,
                imapSecure: inbound.ImapSecure,
                username: inbound.Username,
                hasPassword: !!inbound.EncryptedPassword,
                pollIntervalSeconds: inbound.PollIntervalSeconds,
            } : null,
            outbound: outbound ? {
                protocol: outbound.Protocol,
                smtpHost: outbound.SmtpHost,
                smtpPort: outbound.SmtpPort,
                smtpSecure: outbound.SmtpSecure,
                username: outbound.Username,
                hasPassword: !!outbound.EncryptedPassword,
                fromName: outbound.FromName,
                fromAddress: outbound.FromAddress,
                replyToAddress: outbound.ReplyToAddress,
            } : null,
        });
    } catch (error) {
        next(error);
    }
}) as any);

/**
 * POST /api/email-channels
 * Cria um novo canal de email com configurações de entrada e saída.
 */
router.post("/", requireRole("ADMIN"), validateBody(createChannelSchema), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) return res.status(400).json({ error: "TenantId required" });

        const { name, emailAddress, providerType, defaultQueueId, inbound, outbound } = req.body;

        // Criar o canal
        const channel = await createEmailChannel({
            TenantId: tenantId,
            Name: name,
            EmailAddress: emailAddress,
            ProviderType: providerType,
            DefaultQueueId: defaultQueueId,
        });

        // Salvar configurações de entrada (se fornecidas)
        if (inbound) {
            await upsertInboundSettings(channel.EmailChannelId, {
                Protocol: "IMAP",
                ImapHost: inbound.imapHost.trim(),
                ImapPort: inbound.imapPort,
                ImapSecure: inbound.imapSecure,
                Username: inbound.username.trim(),
                Password: inbound.password,
                PollIntervalSeconds: inbound.pollIntervalSeconds,
            });
        }

        // Salvar configurações de saída (se fornecidas)
        if (outbound) {
            await upsertOutboundSettings(channel.EmailChannelId, {
                Protocol: "SMTP",
                SmtpHost: outbound.smtpHost.trim(),
                SmtpPort: outbound.smtpPort,
                SmtpSecure: outbound.smtpSecure,
                Username: outbound.username.trim(),
                Password: outbound.password,
                FromName: outbound.fromName,
                FromAddress: outbound.fromAddress || emailAddress,
                ReplyToAddress: outbound.replyToAddress,
            });
        }

        logger.info(
            { channelId: channel.EmailChannelId, tenantId, email: emailAddress },
            "[EmailChannels] Channel created"
        );

        res.status(201).json({ ok: true, channel });
    } catch (error) {
        next(error);
    }
}) as any);

/**
 * PUT /api/email-channels/:id
 * Atualiza um canal de email existente.
 */
router.put("/:id", requireRole("ADMIN"), validateBody(updateChannelSchema), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const channel = await getEmailChannelById(req.params.id);
        if (!channel || channel.TenantId !== req.user.tenantId) {
            return res.status(404).json({ error: "Canal não encontrado" });
        }

        const { name, emailAddress, providerType, isActive, defaultQueueId, inbound, outbound } = req.body;

        // Atualizar o canal
        await updateEmailChannel(channel.EmailChannelId, {
            ...(name !== undefined && { Name: name }),
            ...(emailAddress !== undefined && { EmailAddress: emailAddress }),
            ...(providerType !== undefined && { ProviderType: providerType }),
            ...(isActive !== undefined && { IsActive: isActive }),
            ...(defaultQueueId !== undefined && { DefaultQueueId: defaultQueueId }),
        });

        // Atualizar inbound settings
        if (inbound) {
            await upsertInboundSettings(channel.EmailChannelId, {
                ...(inbound.imapHost !== undefined && { ImapHost: inbound.imapHost.trim() }),
                ...(inbound.imapPort !== undefined && { ImapPort: inbound.imapPort }),
                ...(inbound.imapSecure !== undefined && { ImapSecure: inbound.imapSecure }),
                ...(inbound.username !== undefined && { Username: inbound.username.trim() }),
                ...(inbound.password && { Password: inbound.password }),
                ...(inbound.pollIntervalSeconds !== undefined && { PollIntervalSeconds: inbound.pollIntervalSeconds }),
            });
        }

        // Atualizar outbound settings
        if (outbound) {
            await upsertOutboundSettings(channel.EmailChannelId, {
                ...(outbound.smtpHost !== undefined && { SmtpHost: outbound.smtpHost.trim() }),
                ...(outbound.smtpPort !== undefined && { SmtpPort: outbound.smtpPort }),
                ...(outbound.smtpSecure !== undefined && { SmtpSecure: outbound.smtpSecure }),
                ...(outbound.username !== undefined && { Username: outbound.username.trim() }),
                ...(outbound.password && { Password: outbound.password }),
                ...(outbound.fromName !== undefined && { FromName: outbound.fromName }),
                ...(outbound.fromAddress !== undefined && { FromAddress: outbound.fromAddress }),
                ...(outbound.replyToAddress !== undefined && { ReplyToAddress: outbound.replyToAddress }),
            });
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

/**
 * DELETE /api/email-channels/:id
 * Soft-delete de um canal de email.
 */
router.delete("/:id", requireRole("ADMIN"), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const channel = await getEmailChannelById(req.params.id);
        if (!channel || channel.TenantId !== req.user.tenantId) {
            return res.status(404).json({ error: "Canal não encontrado" });
        }

        await deleteEmailChannel(channel.EmailChannelId);

        logger.info(
            { channelId: channel.EmailChannelId },
            "[EmailChannels] Channel deleted"
        );

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

/**
 * POST /api/email-channels/:id/test-inbound
 * Testa a conexão IMAP (verifica credenciais e acesso à INBOX).
 */
router.post("/:id/test-inbound", requireRole("ADMIN"), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const channel = await getEmailChannelById(req.params.id);
        if (!channel || channel.TenantId !== req.user.tenantId) {
            return res.status(404).json({ error: "Canal não encontrado" });
        }

        const inbound = await getInboundSettings(channel.EmailChannelId);
        if (!inbound) {
            return res.status(400).json({ error: "Configurações de entrada não definidas" });
        }

        // Desencriptar para teste
        const decrypted = { ...inbound };
        if (inbound.EncryptedPassword) {
            decrypted.EncryptedPassword = decrypt(inbound.EncryptedPassword);
        }

        const provider = createInboundProvider(channel.ProviderType);
        await provider.testConnection(channel, decrypted);

        res.json({ ok: true, message: "Conexão IMAP bem-sucedida!" });
    } catch (error: any) {
        res.status(400).json({
            ok: false,
            error: `Falha na conexão IMAP: ${error.message || error}`,
        });
    }
}) as any);

/**
 * POST /api/email-channels/:id/test-outbound
 * Testa a conexão SMTP (verifica credenciais).
 */
router.post("/:id/test-outbound", requireRole("ADMIN"), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const channel = await getEmailChannelById(req.params.id);
        if (!channel || channel.TenantId !== req.user.tenantId) {
            return res.status(404).json({ error: "Canal não encontrado" });
        }

        const outbound = await getOutboundSettings(channel.EmailChannelId);
        if (!outbound) {
            return res.status(400).json({ error: "Configurações de saída não definidas" });
        }

        // Desencriptar para teste
        const decrypted = { ...outbound };
        if (outbound.EncryptedPassword) {
            decrypted.EncryptedPassword = decrypt(outbound.EncryptedPassword);
        }

        const provider = createOutboundProvider(channel.ProviderType);
        await provider.testConnection(channel, decrypted);

        res.json({ ok: true, message: "Conexão SMTP bem-sucedida!" });
    } catch (error: any) {
        res.status(400).json({
            ok: false,
            error: `Falha na conexão SMTP: ${error.message || error}`,
        });
    }
}) as any);

export default router;
