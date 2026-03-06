import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { validateBody } from "../middleware/validateMw.js";

const router = Router();

// Submit CSAT rating
router.post("/csat/:conversationId", validateBody(z.object({
    score: z.number().min(1).max(5),
    comment: z.string().optional()
})), (async (req: any, res: any, next: any) => {
    try {
        const { conversationId } = req.params;
        const { score, comment } = req.body;

        const pool = await getPool();

        // 1. Insert into SatisfactionRating
        await pool.request()
            .input("conversationId", conversationId)
            .input("score", score)
            .input("comment", comment || null)
            .query(`
                INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment)
                VALUES (@conversationId, @score, @comment)
            `);

        // 2. Update CsatScore in Conversation for easy access
        await pool.request()
            .input("conversationId", conversationId)
            .input("score", score)
            .query(`
                UPDATE altdesk.Conversation
                SET CsatScore = @score
                WHERE ConversationId = @conversationId
            `);

        res.json({ ok: true, message: "Obrigado pela sua avaliação!" });
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
