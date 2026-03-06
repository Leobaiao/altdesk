import { Router } from "express";
import { z } from "zod";
import { authMw } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { listContacts, createContact, updateContact, deleteContact } from "../services/contact.js";

const router = Router();
router.use(authMw);

router.get("/", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const { search } = req.query;
        const items = await listContacts(user.tenantId, search as string);
        res.json(items);
    } catch (error) {
        next(error);
    }
});

const ContactSchema = z.object({
    name: z.string(),
    phone: z.string(),
    email: z.string().email().optional().or(z.literal("")).or(z.null()),
    tags: z.array(z.string()).optional().nullable(),
    notes: z.string().optional().nullable()
});

router.post("/", validateBody(ContactSchema), async (req, res, next) => {
    try {
        const user = (req as any).user;
        await createContact(user.tenantId, req.body as any);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.put("/:id", validateBody(ContactSchema.partial()), async (req, res, next) => {
    try {
        const user = (req as any).user;
        await updateContact(user.tenantId, req.params.id, req.body);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const user = (req as any).user;
        await deleteContact(user.tenantId, req.params.id);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export default router;
