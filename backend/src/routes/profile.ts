import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { authMw } from "../mw.js";
import { hashPassword } from "../auth.js";
import { validateBody } from "../middleware/validateMw.js";

const router = Router();

const ProfileSchema = z.object({
    password: z.string().min(6).optional(),
    avatar: z.string().url().optional().or(z.literal("")),
    name: z.string().min(2).optional(),
    position: z.string().optional()
});

// GET /api/profile
router.get("/", authMw, async (req: any, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();
        const r = await pool.request()
            .input("userId", user.userId)
            .query(`
                SELECT u.Email, u.DisplayName AS Name, u.Avatar, u.Position, u.Role, u.HasLogAccess, u.CPF,
                       r.Name AS RoleName, r.CanOpen, r.CanEscalate, r.CanClose, r.CanComment, r.HourlyValue
                FROM altdesk.[User] u
                LEFT JOIN altdesk.Role r ON r.RoleId = u.RoleId
                WHERE u.UserId = @userId
            `);

        if (r.recordset.length === 0) return res.status(404).json({ error: "Usuário não encontrado" });
        res.json(r.recordset[0]);
    } catch (error) {
        next(error);
    }
});

// PUT /api/profile
router.put("/", authMw, validateBody(ProfileSchema), async (req: any, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        const body = req.body as z.infer<typeof ProfileSchema>;

        const pool = await getPool();
        const updates: string[] = [];
        const request = pool.request().input("userId", user.userId);

        if (body.password) {
            const hash = await hashPassword(body.password);
            updates.push("PasswordHash = @hash");
            request.input("hash", hash);
        }

        if (body.avatar !== undefined) {
            updates.push("Avatar = @avatar");
            request.input("avatar", body.avatar || null);
        }

        if (body.name !== undefined) {
            updates.push("DisplayName = @name");
            request.input("name", body.name || null);
        }

        if (body.position !== undefined) {
            updates.push("Position = @position");
            request.input("position", body.position || null);
        }

        if (updates.length > 0) {
            await request.query(`
        UPDATE altdesk.[User]
        SET ${updates.join(", ")}
        WHERE UserId = @userId
      `);
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export default router;
