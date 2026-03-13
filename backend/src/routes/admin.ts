import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import sql from "mssql";
import { getPool } from "../db.js";
import { authMw, requireRole } from "../mw.js";
import { hashPassword } from "../auth.js";
import { validateBody } from "../middleware/validateMw.js";
import { loadConnector } from "../utils.js";
import { AuthenticatedRequest } from "../types/index.js";
import { writeAuditLog, extractRequestInfo } from "../services/auditLog.js";
import { logger } from "../lib/logger.js";

import {
    listTenants,
    createTenantWithAdmin,
    updateTenantSubscription,
    setTenantStatus
} from "../services/tenantService.js";
import {
    listAllInstances,
    listTenantInstances,
    createInstance,
    updateInstanceTenant,
    bulkDeleteInstances
} from "../services/instanceService.js";
import {
    listAllUsers,
    createGlobalUser,
    updateGlobalUser,
    setUserActiveStatus
} from "../services/userService.js";

const router = Router();
router.use(authMw as any, requireRole("SUPERADMIN") as any);

// --- TENANTS ---
router.get("/tenants", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenants = await listTenants();
        res.json(tenants);
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/tenants", validateBody(z.object({
    companyName: z.string().min(2),
    adminName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    planDays: z.number().default(30),
    agentsLimit: z.number().default(5)
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const body = req.body;
        const result = await createTenantWithAdmin({
            companyName: body.companyName,
            adminName: body.adminName,
            email: body.email,
            passwordRaw: body.password,
            planDays: body.planDays,
            agentsLimit: body.agentsLimit
        });

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'CREATE_TENANT',
            targetTable: 'Tenant',
            targetId: result.tenantId,
            afterValues: { companyName: body.companyName, adminEmail: body.email }
        });

        res.json({ ok: true, ...result });
    } catch (error) {
        next(error);
    }
}) as any);

router.put("/tenants/:id", validateBody(z.object({
    agentsLimit: z.number().optional(),
    planDays: z.number().optional()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.params.id;
        const { agentsLimit } = req.body;
        await updateTenantSubscription(tenantId, agentsLimit);

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'UPDATE_SUBSCRIPTION',
            targetTable: 'Tenant',
            targetId: tenantId,
            afterValues: { agentsLimit }
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

router.delete("/tenants/:id", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.params.id;
        await setTenantStatus(tenantId, false);

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'DEACTIVATE_TENANT',
            targetTable: 'Tenant',
            targetId: tenantId
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

router.put("/tenants/:id/reactivate", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.params.id;
        await setTenantStatus(tenantId, true);

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'ACTIVATE_TENANT',
            targetTable: 'Tenant',
            targetId: tenantId
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// --- INSTANCES ---
router.get("/instances", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const instances = await listAllInstances();
        res.json(instances);
    } catch (error) {
        next(error);
    }
}) as any);

router.get("/tenants/:id/instances", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.params.id;
        const instances = await listTenantInstances(tenantId);
        res.json(instances);
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/instances", validateBody(z.object({
    tenantId: z.string().uuid(),
    provider: z.string(),
    name: z.string().min(2),
    config: z.any()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const result = await createInstance(req.body);

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'CREATE_INSTANCE',
            targetTable: 'ChannelConnector',
            targetId: result.connectorId,
            afterValues: { tenantId: req.body.tenantId, provider: req.body.provider, name: req.body.name }
        });

        res.json({ ok: true, connectorId: result.connectorId });
    } catch (error) {
        next(error);
    }
}) as any);

router.put("/instances/:connectorId/tenant", validateBody(z.object({ tenantId: z.string().uuid() })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.body;
        const { connectorId } = req.params;
        await updateInstanceTenant(connectorId, tenantId);

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'UPDATE_INSTANCE_TENANT',
            targetTable: 'ChannelConnector',
            targetId: connectorId,
            afterValues: { newTenantId: tenantId }
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

router.get("/instances/:connectorId/webhook", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { connectorId } = req.params;
        const connector = await loadConnector(connectorId);
        const provider = String(connector.Provider).toLowerCase();
        const adapters = req.app.get("adapters");
        const adapter = adapters[provider];

        if (!adapter || !adapter.getWebhook) {
            return res.status(400).json({ error: `Provider "${connector.Provider}" não suporta consulta de webhook.` });
        }

        const data = await adapter.getWebhook(connector);
        res.json(data);
    } catch (error) {
        next(error);
    }
}) as any);

router.delete("/instances/:connectorId/webhook/:webhookId", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { connectorId, webhookId } = req.params;
        const connector = await loadConnector(connectorId);
        const provider = String(connector.Provider).toLowerCase();
        const adapters = req.app.get("adapters");
        const adapter = adapters[provider];

        if (!adapter || !adapter.removeWebhook) {
            return res.status(400).json({ error: `Provider "${connector.Provider}" não suporta remoção de webhook.` });
        }

        await adapter.removeWebhook(connector, webhookId);

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'REMOVE_WEBHOOK',
            targetTable: 'ChannelConnector',
            targetId: connectorId,
            afterValues: { webhookId }
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/instances/:connectorId/set-webhook", validateBody(z.object({
    webhookBaseUrl: z.string().optional(),
    enabled: z.boolean().optional().default(true),
    events: z.array(z.string()).optional(),
    excludeMessages: z.array(z.string()).optional(),
    addUrlEvents: z.boolean().optional(),
    addUrlTypesMessages: z.boolean().optional()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { connectorId } = req.params;
        const { webhookBaseUrl, enabled, events, excludeMessages, addUrlEvents, addUrlTypesMessages } = req.body;
        const connector = await loadConnector(connectorId);

        const provider = String(connector.Provider).toLowerCase();
        const adapters = req.app.get("adapters");
        const adapter = adapters[provider];

        if (!adapter || !adapter.setWebhook) {
            return res.status(400).json({ error: `Provider "${connector.Provider}" não suporta configuração automática de webhook.` });
        }

        const baseUrl = webhookBaseUrl || process.env.WEBHOOK_BASE_URL || "";
        const fullWebhookUrl = `${baseUrl.replace(/\/$/, "")}/api/whatsapp/${provider}/${connectorId}/`;

        await adapter.setWebhook(connector, {
            url: fullWebhookUrl,
            enabled,
            events,
            excludeMessages,
            addUrlEvents,
            addUrlTypesMessages
        });

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'SET_WEBHOOK',
            targetTable: 'ChannelConnector',
            targetId: connectorId,
            afterValues: { webhookUrl: fullWebhookUrl, enabled }
        });

        res.json({ ok: true, webhookUrl: fullWebhookUrl });
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/instances/bulk-delete", validateBody(z.object({ connectorIds: z.array(z.string()) })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { connectorIds } = req.body;
        const count = await bulkDeleteInstances(connectorIds);

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'BULK_DELETE_INSTANCES',
            targetTable: 'ChannelConnector',
            afterValues: { connectorIds, count }
        });

        res.json({ ok: true, count });
    } catch (error) {
        next(error);
    }
}) as any);

// --- GLOBAL USERS ---
router.get("/users", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const users = await listAllUsers();
        res.json(users);
    } catch (error) {
        next(error);
    }
}) as any);

router.post("/users", validateBody(z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["ADMIN", "AGENT", "SUPERADMIN"]).default("AGENT")
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const body = req.body;
        const userId = await createGlobalUser({
            tenantId: body.tenantId,
            name: body.name,
            email: body.email,
            passwordRaw: body.password,
            role: body.role
        });

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'CREATE_USER_GLOBAL',
            targetTable: 'User',
            targetId: userId,
            afterValues: { email: body.email, tenantId: body.tenantId, role: body.role }
        });

        res.json({ ok: true, userId });
    } catch (error: any) {
        if (error.message === 'Email já cadastrado') {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
}) as any);

router.put("/users/:id", validateBody(z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().optional(),
    role: z.enum(["ADMIN", "AGENT", "SUPERADMIN"]),
    tenantId: z.string().uuid()
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.id;
        const body = req.body;
        await updateGlobalUser(userId, {
            tenantId: body.tenantId,
            name: body.name,
            email: body.email,
            passwordRaw: body.password,
            role: body.role
        });

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'UPDATE_USER_GLOBAL',
            targetTable: 'User',
            targetId: userId,
            afterValues: { email: body.email, tenantId: body.tenantId, role: body.role }
        });

        res.json({ ok: true });
    } catch (error: any) {
        if (error.code === 'EREQUEST' && error.message.includes('UK_User_Email')) {
            return res.status(400).json({ error: "Email já cadastrado." });
        }
        next(error);
    }
}) as any);

router.put("/users/:id/status", validateBody(z.object({ isActive: z.boolean() })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.id;
        const { isActive } = req.body;
        await setUserActiveStatus(userId, isActive);

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'USER_STATUS_CHANGE_GLOBAL',
            targetTable: 'User',
            targetId: userId,
            afterValues: { isActive }
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// --- GTI ---
router.get("/instances/gti-info", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.query.token as string;
        const baseUrl = (req.query.baseUrl as string) || "https://api.gtiapi.workers.dev";

        if (!token) return res.status(400).json({ error: "Token is required" });

        const url = `${baseUrl}/instance/status`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "token": token,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const txt = await response.text();
            return res.status(response.status).json({ error: "GTI Error: " + txt });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
