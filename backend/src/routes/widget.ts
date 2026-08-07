import { Router } from "express";
import { z } from "zod";
import { authMw, requireRole } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { Response, NextFunction } from "express";
import { writeAuditLog, extractRequestInfo } from "../services/auditLog.js";
import {
    getWidgetConfig,
    updateWidgetConfig,
    publishWidget
} from "../services/widgetService.js";

const router = Router();
router.use(authMw, requireRole("ADMIN", "SUPERADMIN"));

/**
 * GET /api/widget — Retorna configuração do widget do tenant autenticado
 */
router.get("/", async (req: any, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user;
        const widget = await getWidgetConfig(tenantId);

        if (!widget) {
            return res.json({ exists: false, config: null });
        }

        res.json({
            exists: true,
            widgetId: widget.WidgetId,
            isActive: widget.IsActive,
            publishedAt: widget.PublishedAt,
            config: widget.config,
            createdAt: widget.CreatedAt,
            updatedAt: widget.UpdatedAt
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/widget — Atualiza ConfigJson do widget (salva rascunho)
 */
router.put("/", validateBody(z.object({
    config: z.record(z.any())
})), async (req: any, res: Response, next: NextFunction) => {
    try {
        const { tenantId, userId } = req.user;
        const { config } = req.body;

        await updateWidgetConfig(tenantId, config);

        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: "UPDATE",
            targetTable: "ChatWidget",
            targetId: tenantId,
            afterValues: { configUpdated: true }
        });

        res.json({ ok: true, message: "Configuração salva com sucesso." });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/widget/publish — Publica o widget (torna visível no site do tenant)
 */
router.post("/publish", async (req: any, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user;
        await publishWidget(tenantId);

        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: "PUBLISH",
            targetTable: "ChatWidget",
            targetId: tenantId,
            afterValues: { published: true }
        });

        res.json({ ok: true, message: "Widget publicado com sucesso." });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/widget/snippet — Retorna o snippet HTML pronto para colar
 */
router.get("/snippet", async (req: any, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user;
        const backendUrl = process.env.BACKEND_PUBLIC_URL || process.env.VITE_API_URL || "https://api.altdesk.com.br";

        const snippet = `<script src="${backendUrl}/altdesk-widget.js" data-tenant="${tenantId}" data-backend="${backendUrl}"></script>`;

        res.json({ snippet, tenantId, backendUrl });
    } catch (error) {
        next(error);
    }
});

export default router;
