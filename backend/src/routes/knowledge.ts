import { Router } from "express";
import { z } from "zod";
import { authMw } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { AuthenticatedRequest } from "../types/index.js";
import {
    listArticles,
    createArticle,
    updateArticle,
    deleteArticle,
    searchArticles,
    searchArticlesByConnector
} from "../services/knowledgeService.js";

const router = Router();

// Public search (no auth required for widget)
router.get("/public/search", (async (req: any, res: any, next: any) => {
    try {
        const { q, tenantId, cid } = req.query;
        if (cid) {
            const articles = await searchArticlesByConnector(String(cid), String(q || ""));
            return res.json(articles);
        }
        if (!tenantId) return res.status(400).json({ error: "tenantId or cid required" });
        const articles = await searchArticles(String(tenantId), String(q || ""));
        res.json(articles);
    } catch (error) {
        next(error);
    }
}) as any);

// Auth required for management
router.use(authMw);

// List all articles
router.get("/", (async (req: any, res: any, next: any) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const articles = await listArticles(authReq.user.tenantId || "");
        res.json(articles);
    } catch (error) {
        next(error);
    }
}) as any);

// Create article
router.post("/", validateBody(z.object({
    Title: z.string().min(1),
    Content: z.string().min(1),
    Category: z.string().optional(),
    IsPublic: z.boolean().optional()
})), (async (req: any, res: any, next: any) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const article = await createArticle(authReq.user.tenantId || "", authReq.body);
        res.status(201).json(article);
    } catch (error) {
        next(error);
    }
}) as any);

// Update article
router.put("/:id", validateBody(z.object({
    Title: z.string().min(1),
    Content: z.string().min(1),
    Category: z.string().optional(),
    IsPublic: z.boolean().optional()
})), (async (req: any, res: any, next: any) => {
    try {
        const authReq = req as AuthenticatedRequest;
        await updateArticle(authReq.user.tenantId || "", authReq.params.id, authReq.body);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// Delete article
router.delete("/:id", (async (req: any, res: any, next: any) => {
    try {
        const authReq = req as AuthenticatedRequest;
        await deleteArticle(authReq.user.tenantId || "", authReq.params.id);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
