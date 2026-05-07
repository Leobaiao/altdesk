import { Router } from "express";
import { z } from "zod";
import { authMw, requirePermission } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { listCannedResponses, createCannedResponse, deleteCannedResponse, updateCannedResponse } from "../services/canned-response.js";

const router = Router();
router.use(authMw);

router.get("/", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const items = await listCannedResponses(user.tenantId);
        res.json(items);
    } catch (error) {
        next(error);
    }
});

router.post("/", requirePermission('settings'), validateBody(z.object({
    shortcut: z.string().min(1),
    content: z.string().min(1),
    title: z.string().min(1)
})), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const { shortcut, content, title } = req.body;
        await createCannedResponse(user.tenantId, shortcut, content, title);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", requirePermission('settings'), async (req, res, next) => {
    try {
        const user = (req as any).user;
        await deleteCannedResponse(user.tenantId, req.params.id);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.put("/:id", requirePermission('settings'), validateBody(z.object({
    shortcut: z.string().min(1),
    content: z.string().min(1),
    title: z.string().min(1)
})), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const { shortcut, content, title } = req.body;
        await updateCannedResponse(user.tenantId, req.params.id, shortcut, content, title);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});


export default router;
