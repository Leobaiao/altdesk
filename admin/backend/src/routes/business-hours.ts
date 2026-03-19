import { Router } from "express";
import { z } from "zod";
import { authMw } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import {
    getBusinessHours,
    setBusinessHours,
    getOffHoursMessage,
    setOffHoursMessage
} from "../services/businessHoursService.js";

const router = Router();
router.use(authMw);

// Get business hours
router.get("/", (async (req: any, res: any, next: any) => {
    try {
        const tenantId = req.user.tenantId;
        const hours = await getBusinessHours(tenantId);
        const offHoursMessage = await getOffHoursMessage(tenantId);
        res.json({ hours, offHoursMessage });
    } catch (error) {
        next(error);
    }
}) as any);

// Save business hours
router.put("/", validateBody(z.object({
    hours: z.array(z.object({
        DayOfWeek: z.number().min(0).max(6),
        StartTime: z.string(),
        EndTime: z.string(),
        IsActive: z.boolean()
    })),
    offHoursMessage: z.string().optional()
})), (async (req: any, res: any, next: any) => {
    try {
        const tenantId = req.user.tenantId;
        const { hours, offHoursMessage } = req.body;
        await setBusinessHours(tenantId, hours);
        if (offHoursMessage !== undefined) {
            await setOffHoursMessage(tenantId, offHoursMessage);
        }
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
