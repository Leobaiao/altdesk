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
    setUserActiveStatus,
    listDeletedUsers,
    restoreUser
} from "../services/userService.js";
import { 
    listDeletedTenants,
    restoreTenant
} from "../services/tenantService.js";

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
        const pool = await getPool();
        
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Soft Delete: Move to Trash and deactivate
            await transaction.request()
                .input("id", tenantId)
                .query("UPDATE altdesk.Tenant SET DeletedAt = GETDATE(), IsActive = 0 WHERE TenantId = @id");
            
            await transaction.request()
                .input("id", tenantId)
                .query("UPDATE altdesk.Subscription SET IsActive = 0 WHERE TenantId = @id");

            // Cascade to Users
            await transaction.request()
                .input("id", tenantId)
                .query("UPDATE altdesk.[User] SET DeletedAt = GETDATE(), IsActive = 0 WHERE TenantId = @id AND DeletedAt IS NULL");

            // Cascade to Agents
            await transaction.request()
                .input("id", tenantId)
                .query("UPDATE altdesk.Agent SET IsActive = 0 WHERE TenantId = @id");

            // Cascade to Connectors (Channels)
            await transaction.request()
                .input("id", tenantId)
                .query(`
                    UPDATE cc SET IsActive = 0, DeletedAt = GETDATE()
                    FROM altdesk.ChannelConnector cc
                    JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
                    WHERE ch.TenantId = @id AND cc.DeletedAt IS NULL
                `);

            await transaction.commit();

            // Audit Log
            const reqInfo = extractRequestInfo(req);
            await writeAuditLog({
                ...reqInfo,
                action: 'SOFT_DELETE_TENANT_CASCADE',
                targetTable: 'Tenant',
                targetId: tenantId
            });

            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
}) as any);

router.delete("/tenants/:id/permanent", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.params.id;
        const pool = await getPool();

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Delete in order of dependencies (bottom-up)
            
            // 1. Level 3 dependencies (depend on conversations/tickets)
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.TicketEvent WHERE TicketId IN (SELECT TicketId FROM altdesk.Ticket WHERE TenantId = @tid)");
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.Ticket WHERE TenantId = @tid");
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.Message WHERE TenantId = @tid");
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.ConversationHistory WHERE TenantId = @tid");
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.ConversationTag WHERE ConversationId IN (SELECT ConversationId FROM altdesk.Conversation WHERE TenantId = @tid)");
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.ExternalThreadMap WHERE TenantId = @tid");
            
            // 2. Level 2 dependencies (conversations, connectors, bills)
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.Conversation WHERE TenantId = @tid");
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.ChannelConnector WHERE ChannelId IN (SELECT ChannelId FROM altdesk.Channel WHERE TenantId = @tid)");
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.BillingInvoice WHERE TenantId = @tid");
            
            // 3. Level 1 dependencies (channels, queues, contacts, agents, sub-entities)
            const level1Tables = [
                "Channel", "Queue", "Contact", "KnowledgeArticle", 
                "CannedResponse", "Tag", "Template", "Agent", 
                "BillingSubscription", "BillingCustomer", "AuditLog"
            ];
            for (const table of level1Tables) {
                await transaction.request().input("tid", tenantId).query(`DELETE FROM altdesk.${table} WHERE TenantId = @tid`);
            }

            // 4. Core dependencies (users, roles, subscription)
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.[User] WHERE TenantId = @tid");
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.Role WHERE TenantId = @tid");
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.Subscription WHERE TenantId = @tid");

            // Finally the tenant
            await transaction.request().input("tid", tenantId).query("DELETE FROM altdesk.Tenant WHERE TenantId = @tid");

            await transaction.commit();

            // Audit
            const reqInfo = extractRequestInfo(req);
            await writeAuditLog({
                ...reqInfo,
                action: 'DELETE_TENANT_PERMANENT',
                targetTable: 'Tenant',
                targetId: tenantId
            });

            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
}) as any);

router.put("/tenants/:id/status", validateBody(z.object({ isActive: z.boolean() })), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.params.id;
        const { isActive } = req.body;
        await setTenantStatus(tenantId, isActive);

        // Audit Log
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: isActive ? 'ACTIVATE_TENANT' : 'DEACTIVATE_TENANT',
            targetTable: 'Tenant',
            targetId: tenantId
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

// --- TRASH (LIXEIRA) ---
router.get("/trash/tenants", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const tenants = await listDeletedTenants();
        res.json(tenants);
    } catch (error) { next(error); }
}) as any);

router.get("/trash/users", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const users = await listDeletedUsers();
        res.json(users);
    } catch (error) { next(error); }
}) as any);

router.post("/trash/tenants/:id/restore", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        await restoreTenant(req.params.id);
        res.json({ ok: true });
    } catch (error) { next(error); }
}) as any);

router.post("/trash/users/:id/restore", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        await restoreUser(req.params.id);
        res.json({ ok: true });
    } catch (error) { next(error); }
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

router.post("/instances/:connectorId/connect", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { connectorId } = req.params;
        const { phone } = req.body;
        const connector = await loadConnector(connectorId);

        if (connector.Provider !== "GTI") {
            return res.status(400).json({ error: "Conexão por QR/Pair Code suportada apenas para provedor GTI." });
        }

        const cfg = JSON.parse(connector.ConfigJson);
        const baseUrl = cfg.baseUrl ?? "https://api.gtiapi.workers.dev";
        const token = cfg.token || cfg.apiKey;

        const url = `${baseUrl}/instance/connect`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "token": token,
                "Content-Type": "application/json"
            },
            body: phone ? JSON.stringify({ phone }) : "{}"
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`GTI connect falhou: ${response.status} - ${errBody}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        next(error);
    }
}) as any);

router.delete("/instances/:connectorId/disconnect", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { connectorId } = req.params;
        const connector = await loadConnector(connectorId);

        if (connector.Provider !== "GTI") {
            return res.status(400).json({ error: "Desconexão suportada apenas para provedor GTI." });
        }

        const cfg = JSON.parse(connector.ConfigJson);
        const baseUrl = cfg.baseUrl ?? "https://api.gtiapi.workers.dev";
        const token = cfg.token || cfg.apiKey;

        const response = await fetch(`${baseUrl}/instance/disconnect`, {
            method: "POST",
            headers: { 
                "token": token,
                "apikey": token 
            }
        });

        if (!response.ok) {
            throw new Error(`GTI logout falhou: ${response.status} - ${await response.text()}`);
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
}) as any);

router.get("/instances/:connectorId/status", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { connectorId } = req.params;
        const connector = await loadConnector(connectorId);

        if (connector.Provider !== "GTI") {
            return res.status(400).json({ error: "Check status suportado apenas para provedor GTI." });
        }

        const cfg = JSON.parse(connector.ConfigJson);
        const baseUrl = cfg.baseUrl ?? "https://api.gtiapi.workers.dev";
        const token = cfg.token || cfg.apiKey;

        // Bater no /instance/status usando apenas o TOKEN
        let response = await fetch(`${baseUrl}/instance/status`, {
            method: "GET",
            headers: { 
                "token": token,
                "apikey": token 
            }
        });

        if (!response.ok) {
            throw new Error(`GTI status falhou: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        
        // Mapeamento baseado no teste do usuário: status.connected (true/false)
        // e instance.status ("connected", "close", etc)
        const isConnected = data.status?.connected === true || data.loggedIn === true;
        const state = isConnected ? "open" : (data.instance?.status || "close");
        
        // Atualiza campos extras se disponíveis (como o número do telefone)
        if (data.instance?.owner && cfg.phoneNumberId !== data.instance.owner) {
            cfg.phoneNumberId = data.instance.owner;
        }

        if (state && cfg.connectionStatus !== state) {
            cfg.connectionStatus = state;
            const newConfig = JSON.stringify(cfg);
            const pool = await (await import('../db.js')).getPool();
            await pool.request()
                .input('connectorId', connectorId)
                .input('configJson', newConfig)
                .query('UPDATE altdesk.ChannelConnector SET ConfigJson = @configJson WHERE ConnectorId = @connectorId');
        }

        res.json({ status: state, raw: data });
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

// --- AUDIT LOGS ---
router.get("/audit-logs", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const pool = await getPool();
        const { tenantId, action, from, to, page = "1", limit = "50" } = req.query as Record<string, string>;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = "WHERE 1=1";
        const request = pool.request();

        if (tenantId) {
            where += " AND al.TenantId = @tenantId";
            request.input("tenantId", tenantId);
        }
        if (action) {
            where += " AND al.Action LIKE @action";
            request.input("action", `%${action}%`);
        }
        if (from) {
            where += " AND al.CreatedAt >= @from";
            request.input("from", new Date(from));
        }
        if (to) {
            where += " AND al.CreatedAt <= @to";
            request.input("to", new Date(to));
        }

        request.input("limit", parseInt(limit));
        request.input("offset", offset);

        const r = await request.query(`
            SELECT TOP (@limit)
                al.LogId, al.Action, al.TargetTable, al.TargetId,
                al.IpAddress, al.CreatedAt,
                u.DisplayName AS UserName, u.Email AS UserEmail,
                t.Name AS TenantName
            FROM altdesk.AuditLog al
            LEFT JOIN altdesk.[User] u ON u.UserId = al.UserId
            LEFT JOIN altdesk.Tenant t ON t.TenantId = al.TenantId
            ${where}
            ORDER BY al.CreatedAt DESC
            OFFSET @offset ROWS
        `);
        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
}) as any);

// --- BILLING MANAGEMENT ---

// List all billing plans
router.get("/billing/plans", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const pool = await getPool();
        const r = await pool.request().query("SELECT * FROM altdesk.BillingPlan ORDER BY PriceCents");
        res.json(r.recordset);
    } catch (error) { next(error); }
}) as any);

// Create a billing plan
router.post("/billing/plans", validateBody(z.object({
    code: z.string().min(2),
    name: z.string().min(2),
    priceCents: z.number().min(0),
    cycle: z.enum(["monthly", "quarterly", "yearly"]).optional(),
    agentsSeatLimit: z.number().min(1).optional(),
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { code, name, priceCents, cycle, agentsSeatLimit } = req.body;
        const pool = await getPool();
        await pool.request()
            .input("code", code)
            .input("name", name)
            .input("priceCents", priceCents)
            .input("cycle", cycle || "monthly")
            .input("agentsSeatLimit", agentsSeatLimit || 3)
            .query(`
                INSERT INTO altdesk.BillingPlan (Code, Name, PriceCents, Cycle, AgentsSeatLimit)
                VALUES (@code, @name, @priceCents, @cycle, @agentsSeatLimit)
            `);

        const reqInfo = extractRequestInfo(req);
        await writeAuditLog({
            userId: reqInfo.userId,
            tenantId: reqInfo.tenantId,
            action: "CREATE_BILLING_PLAN",
            targetTable: "BillingPlan",
            targetId: code,
            ipAddress: reqInfo.ipAddress,
            userAgent: reqInfo.userAgent
        });

        res.status(201).json({ ok: true });
    } catch (error) { next(error); }
}) as any);

// Update a billing plan
router.put("/billing/plans/:id", validateBody(z.object({
    name: z.string().min(2).optional(),
    priceCents: z.number().min(0).optional(),
    agentsSeatLimit: z.number().min(1).optional(),
    isActive: z.boolean().optional(),
})), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, priceCents, agentsSeatLimit, isActive } = req.body;
        const pool = await getPool();

        const sets: string[] = [];
        const request = pool.request().input("planId", id);

        if (name !== undefined) { sets.push("Name = @name"); request.input("name", name); }
        if (priceCents !== undefined) { sets.push("PriceCents = @priceCents"); request.input("priceCents", priceCents); }
        if (agentsSeatLimit !== undefined) { sets.push("AgentsSeatLimit = @agentsSeatLimit"); request.input("agentsSeatLimit", agentsSeatLimit); }
        if (isActive !== undefined) { sets.push("IsActive = @isActive"); request.input("isActive", isActive ? 1 : 0); }

        if (sets.length === 0) return res.json({ ok: true });

        await request.query(`UPDATE altdesk.BillingPlan SET ${sets.join(", ")} WHERE PlanId = @planId`);

        const reqInfo2 = extractRequestInfo(req);
        await writeAuditLog({
            userId: reqInfo2.userId,
            tenantId: reqInfo2.tenantId,
            action: "UPDATE_BILLING_PLAN",
            targetTable: "BillingPlan",
            targetId: id,
            ipAddress: reqInfo2.ipAddress,
            userAgent: reqInfo2.userAgent
        });

        res.json({ ok: true });
    } catch (error) { next(error); }
}) as any);

// List all subscriptions (across tenants)
router.get("/billing/subscriptions", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const pool = await getPool();
        const r = await pool.request().query(`
            SELECT bs.*, bp.Code AS PlanCode, bp.Name AS PlanName, t.Name AS TenantName
            FROM altdesk.BillingSubscription bs
            JOIN altdesk.BillingPlan bp ON bp.PlanId = bs.PlanId
            JOIN altdesk.Tenant t ON t.TenantId = bs.TenantId
            ORDER BY bs.CreatedAt DESC
        `);
        res.json(r.recordset);
    } catch (error) { next(error); }
}) as any);

// List all invoices (across tenants)
router.get("/billing/invoices", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const pool = await getPool();
        const r = await pool.request().query(`
            SELECT bi.*, t.Name AS TenantName
            FROM altdesk.BillingInvoice bi
            JOIN altdesk.Tenant t ON t.TenantId = bi.TenantId
            ORDER BY bi.CreatedAt DESC
        `);
        res.json(r.recordset);
    } catch (error) { next(error); }
}) as any);

// --- SOFT DELETE USER ---
router.delete("/users/:id", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.id;
        const pool = await getPool();

        const check = await pool.request()
            .input("id", userId)
            .query("SELECT Role, TenantId FROM altdesk.[User] WHERE UserId=@id");

        if (check.recordset.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request().input("id", userId)
                .query("UPDATE altdesk.Agent SET IsActive=0 WHERE UserId=@id");
            await transaction.request().input("id", userId)
                .query("UPDATE altdesk.[User] SET IsActive=0, DeletedAt=GETDATE() WHERE UserId=@id");
            await transaction.commit();

            const reqInfo = extractRequestInfo(req);
            await writeAuditLog({
                userId: reqInfo.userId,
                tenantId: reqInfo.tenantId,
                action: "SOFT_DELETE_USER",
                targetTable: "User",
                targetId: userId,
                ipAddress: reqInfo.ipAddress,
                userAgent: reqInfo.userAgent
            });

            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) { next(error); }
}) as any);

// --- PERMANENT DELETE USER ---
router.delete("/users/:id/permanent", (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.id;
        const pool = await getPool();

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request().input("id", userId)
                .query("DELETE FROM altdesk.Agent WHERE UserId=@id");
            await transaction.request().input("id", userId)
                .query("DELETE FROM altdesk.[User] WHERE UserId=@id");
            await transaction.commit();

            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) { next(error); }
}) as any);

export default router;



