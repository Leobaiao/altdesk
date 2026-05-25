import { Router } from "express";
import { z } from "zod";
import { authMw, requirePermission } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { AuthenticatedRequest } from "../types/index.js";
import {
    getHelpArticle,
    listHelpArticles,
    upsertHelpArticle,
    deleteHelpArticle
} from "../services/helpService.js";

const router = Router();

// ── Admin Routes (must come BEFORE /:contextKey to avoid being captured) ──

// 1. List help articles (requires 'settings' permission)
router.get("/", authMw, requirePermission("settings"), (async (req: any, res: any, next: any) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const isSuperAdmin = authReq.user.role === "SUPERADMIN";
        
        // Se for SuperAdmin, lista todos (incluindo globais). Caso contrário, filtra pelo tenant do usuário.
        const tenantId = isSuperAdmin ? null : authReq.user.tenantId;
        
        const articles = await listHelpArticles(tenantId);
        res.json(articles);
    } catch (error) {
        next(error);
    }
}) as any);

// 2. Upsert help article (requires 'settings' permission)
const upsertSchema = z.object({
    HelpArticleId: z.string().uuid().optional(),
    ContextKey: z.string().min(1).max(120),
    Title: z.string().min(1).max(200),
    Content: z.string().min(1),
    Category: z.string().max(100).optional().nullable(),
    PagePath: z.string().max(200).optional().nullable(),
    IsActive: z.boolean().optional(),
    IsGlobal: z.boolean().optional() // Indica se deseja salvar como global (apenas SuperAdmin pode)
});

router.post("/", authMw, requirePermission("settings"), validateBody(upsertSchema), (async (req: any, res: any, next: any) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const isSuperAdmin = authReq.user.role === "SUPERADMIN";
        const body = authReq.body;

        // Determina o TenantId com base nas permissões
        let targetTenantId: string | null = authReq.user.tenantId || null;
        
        if (isSuperAdmin) {
            // SuperAdmin pode escolher salvar como global (sem tenant) ou associado a algum tenant específico
            targetTenantId = body.IsGlobal ? null : (body.TenantId || null);
        } else if (body.IsGlobal) {
            return res.status(403).json({ error: "Apenas SuperAdmins podem criar ou editar artigos de ajuda globais." });
        }

        const articleData = {
            TenantId: targetTenantId,
            ContextKey: body.ContextKey,
            Title: body.Title,
            Content: body.Content,
            Category: body.Category,
            PagePath: body.PagePath,
            IsActive: body.IsActive ?? true
        };

        const article = await upsertHelpArticle(articleData);
        res.status(200).json(article);
    } catch (error) {
        next(error);
    }
}) as any);

// 3. Delete help article (requires 'settings' permission)
router.delete("/:id", authMw, requirePermission("settings"), (async (req: any, res: any, next: any) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const isSuperAdmin = authReq.user.role === "SUPERADMIN";
        const tenantId = isSuperAdmin ? null : authReq.user.tenantId;

        const success = await deleteHelpArticle(req.params.id, tenantId);
        if (!success) {
            return res.status(404).json({ error: "Artigo de ajuda não encontrado ou você não tem permissão para excluí-lo." });
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// ── Public Route (any logged-in user can read contextual help) ──
// IMPORTANT: This must come LAST because /:contextKey is a wildcard that captures everything

// 4. Get contextual help article by contextKey
router.get("/:contextKey", authMw, (async (req: any, res: any, next: any) => {
    try {
        const { contextKey } = req.params;
        const authReq = req as AuthenticatedRequest;
        const tenantId = authReq.user.tenantId;

        const article = await getHelpArticle(contextKey, tenantId);

        if (!article) {
            return res.status(404).json({
                title: "Ajuda não cadastrada",
                content: "Ainda não existe conteúdo de ajuda cadastrado para esta tela.",
                contextKey
            });
        }

        res.json(article);
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
