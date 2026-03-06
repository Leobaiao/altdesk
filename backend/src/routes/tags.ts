import { Router } from "express";
import { z } from "zod";
import { authMw } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { AuthenticatedRequest } from "../types/index.js";
import {
    listTags,
    createTag,
    deleteTag,
    assignTagToConversation,
    removeTagFromConversation
} from "../services/tagService.js";
import { checkConversationAccess } from "../services/chatService.js";

const router = Router();
router.use(authMw);

// List all tags for tenant
router.get("/", (async (req: AuthenticatedRequest, res: any, next: any) => {
    try {
        const tags = await listTags(req.user.tenantId || "");
        res.json(tags);
    } catch (error) {
        next(error);
    }
}) as any);

// Create a new tag
router.post("/", validateBody(z.object({
    name: z.string().min(1),
    color: z.string().startsWith("#").optional()
})), (async (req: AuthenticatedRequest, res: any, next: any) => {
    try {
        const { name, color } = req.body;
        const tag = await createTag(req.user.tenantId || "", name, color || "#E2E8F0");
        res.status(201).json(tag);
    } catch (error) {
        next(error);
    }
}) as any);

// Delete a tag
router.delete("/:id", (async (req: AuthenticatedRequest, res: any, next: any) => {
    try {
        await deleteTag(req.user.tenantId || "", req.params.id);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// Assign tag to conversation
router.post("/conversations/:conversationId", validateBody(z.object({
    tagId: z.string().uuid()
})), (async (req: AuthenticatedRequest, res: any, next: any) => {
    try {
        const { conversationId } = req.params;
        const { tagId } = req.body;

        const { allowed } = await checkConversationAccess(req.user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        await assignTagToConversation(conversationId, tagId);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// Remove tag from conversation
router.delete("/conversations/:conversationId/:tagId", (async (req: AuthenticatedRequest, res: any, next: any) => {
    try {
        const { conversationId, tagId } = req.params;

        const { allowed } = await checkConversationAccess(req.user, conversationId);
        if (!allowed) return res.status(403).json({ error: "Access denied" });

        await removeTagFromConversation(conversationId, tagId);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
