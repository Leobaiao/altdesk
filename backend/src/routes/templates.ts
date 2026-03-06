import { Router } from "express";
import { z } from "zod";
import { authMw } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { listTemplates, createTemplate, deleteTemplate } from "../services/template.js";

const router = Router();
router.use(authMw);

router.get("/", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const items = await listTemplates(user.tenantId);
        res.json(items);
    } catch (error) {
        next(error);
    }
});

router.post("/", validateBody(z.object({
    name: z.string().min(1),
    content: z.string().min(1),
    variables: z.array(z.string()).optional()
})), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const { name, content, variables } = req.body;
        await createTemplate(user.tenantId, name, content, variables || []);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const user = (req as any).user;
        await deleteTemplate(user.tenantId, req.params.id);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export default router;
