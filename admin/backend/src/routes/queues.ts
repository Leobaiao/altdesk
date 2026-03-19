import { Router } from "express";
import { z } from "zod";
import { authMw } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { listQueues, createQueue, deleteQueue } from "../services/queue.js";

const router = Router();
router.use(authMw);

router.get("/", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const items = await listQueues(user.tenantId);
        res.json(items);
    } catch (error) {
        next(error);
    }
});

router.post("/", validateBody(z.object({ name: z.string().min(1) })), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const { name } = req.body;
        await createQueue(user.tenantId, name);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const user = (req as any).user;
        await deleteQueue(user.tenantId, req.params.id);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export default router;
