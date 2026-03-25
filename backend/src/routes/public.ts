import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { getPool } from "../db.js";
import { validateBody } from "../middleware/validateMw.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { hashPassword } from "../auth.js";

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

// Request password reset
router.post("/forgot-password", validateBody(z.object({
    email: z.string().email()
})), (async (req: any, res: any, next: any) => {
    try {
        const { email } = req.body;
        const pool = await getPool();

        // 1. Find user
        const userRes = await pool.request()
            .input("email", email)
            .query("SELECT UserId FROM altdesk.[User] WHERE Email = @email AND IsActive = 1");

        const user = userRes.recordset[0];
        if (!user) {
            // Shadow success for security
            return res.json({ ok: true, message: "Se o email estiver cadastrado, você receberá um link de recuperação." });
        }

        // 2. Generate token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        // 3. Save token
        await pool.request()
            .input("userId", user.UserId)
            .input("token", token)
            .input("expiresAt", expiresAt)
            .query(`
                INSERT INTO altdesk.PasswordResetToken (UserId, Token, ExpiresAt)
                VALUES (@userId, @token, @expiresAt)
            `);

        // 4. Send email
        const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;
        await sendPasswordResetEmail(email, resetLink);

        res.json({ ok: true, message: "Se o email estiver cadastrado, você receberá um link de recuperação." });
    } catch (error) {
        next(error);
    }
}) as any);

// Reset password using token
router.post("/reset-password", validateBody(z.object({
    token: z.string(),
    password: z.string().min(6)
})), (async (req: any, res: any, next: any) => {
    try {
        const { token, password } = req.body;
        const pool = await getPool();

        // 1. Validate token
        const tokenRes = await pool.request()
            .input("token", token)
            .query(`
                SELECT UserId FROM altdesk.PasswordResetToken 
                WHERE Token = @token AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()
            `);

        const tokenData = tokenRes.recordset[0];
        if (!tokenData) {
            return res.status(400).json({ error: "Token inválido ou expirado." });
        }

        // 2. Update password
        const hashedPassword = await hashPassword(password);
        await pool.request()
            .input("userId", tokenData.UserId)
            .input("hash", hashedPassword)
            .query("UPDATE altdesk.[User] SET PasswordHash = @hash WHERE UserId = @userId");

        // 3. Mark token as used
        await pool.request()
            .input("token", token)
            .query("UPDATE altdesk.PasswordResetToken SET UsedAt = SYSUTCDATETIME() WHERE Token = @token");

        res.json({ ok: true, message: "Senha redefinida com sucesso!" });
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
