import { Router } from "express";
import { z } from "zod";
import sql from "mssql";
import { getPool } from "../db.js";
import { authMw, requireRole } from "../mw.js";
import { hashPassword } from "../auth.js";
import { validateBody } from "../middleware/validateMw.js";
import { loadConnector } from "../utils.js";

const router = Router();
router.use(authMw, requireRole("SUPERADMIN"));

// --- TENANTS ---
router.get("/tenants", async (req, res, next) => {
    try {
        const pool = await getPool();
        const r = await pool.request().query(`
      SELECT t.TenantId, t.Name, t.CreatedAt, 
             s.IsActive, s.ExpiresAt, s.AgentsSeatLimit,
             (SELECT COUNT(*) FROM omni.[User] u WHERE u.TenantId = t.TenantId AND u.IsActive=1) as UserCount,
             (
               SELECT COUNT(*) FROM omni.ChannelConnector cc 
               JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId 
               WHERE ch.TenantId = t.TenantId AND cc.IsActive=1 AND cc.DeletedAt IS NULL
             ) as InstanceCount
      FROM omni.Tenant t
      LEFT JOIN omni.Subscription s ON s.TenantId = t.TenantId
      ORDER BY t.CreatedAt DESC
    `);
        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
});

router.post("/tenants", validateBody(z.object({
    companyName: z.string().min(2),
    adminName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    planDays: z.number().default(30),
    agentsLimit: z.number().default(5)
})), async (req, res, next) => {
    try {
        const body = req.body;
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const rTenant = await transaction.request()
                .input("name", body.companyName)
                .query("INSERT INTO omni.Tenant (Name) OUTPUT inserted.TenantId VALUES (@name)");
            const tenantId = rTenant.recordset[0].TenantId;

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + body.planDays);

            await transaction.request()
                .input("tenantId", tenantId)
                .input("limit", body.agentsLimit)
                .input("expires", expiresAt)
                .query(`
          INSERT INTO omni.Subscription (TenantId, PlanCode, AgentsSeatLimit, StartsAt, ExpiresAt, IsActive)
          VALUES (@tenantId, 'TRIAL', @limit, SYSUTCDATETIME(), @expires, 1)
        `);

            const hash = await hashPassword(body.password);
            const rUser = await transaction.request()
                .input("tenantId", tenantId)
                .input("email", body.email)
                .input("name", body.adminName)
                .input("hash", hash)
                .query(`
          INSERT INTO omni.[User] (TenantId, Email, DisplayName, PasswordHash, Role)
          OUTPUT inserted.UserId
          VALUES (@tenantId, @email, @name, @hash, 'ADMIN')
        `);
            const userId = rUser.recordset[0].UserId;

            await transaction.request()
                .input("tenantId", tenantId)
                .input("userId", userId)
                .input("name", body.adminName)
                .query(`
          INSERT INTO omni.Agent (TenantId, UserId, Kind, Name)
          VALUES (@tenantId, @userId, 'HUMAN', @name)
        `);

            await transaction.commit();
            res.json({ ok: true, tenantId, userId });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
});

router.put("/tenants/:id", validateBody(z.object({
    agentsLimit: z.number().optional(),
    planDays: z.number().optional()
})), async (req, res, next) => {
    try {
        const tenantId = req.params.id;
        const { agentsLimit, planDays } = req.body;
        const pool = await getPool();

        if (agentsLimit !== undefined) {
            await pool.request()
                .input("tid", tenantId)
                .input("limit", agentsLimit)
                .query("UPDATE omni.Subscription SET AgentsSeatLimit = @limit WHERE TenantId = @tid");
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.delete("/tenants/:id", async (req, res, next) => {
    try {
        const tenantId = req.params.id;
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request()
                .input("tenantId", tenantId)
                .query("UPDATE omni.Subscription SET IsActive=0 WHERE TenantId=@tenantId");

            await transaction.request()
                .input("tenantId", tenantId)
                .query("UPDATE omni.[User] SET IsActive=0 WHERE TenantId=@tenantId");

            await transaction.request()
                .input("tenantId", tenantId)
                .query(`
           UPDATE cc SET IsActive=0
           FROM omni.ChannelConnector cc
           JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
           WHERE ch.TenantId = @tenantId
         `);

            await transaction.commit();
            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
});

router.put("/tenants/:id/reactivate", async (req, res, next) => {
    try {
        const tenantId = req.params.id;
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request()
                .input("tenantId", tenantId)
                .query("UPDATE omni.Subscription SET IsActive=1 WHERE TenantId=@tenantId");

            await transaction.request()
                .input("tenantId", tenantId)
                .query("UPDATE omni.[User] SET IsActive=1 WHERE TenantId=@tenantId");

            await transaction.request()
                .input("tenantId", tenantId)
                .query(`
           UPDATE cc SET IsActive=1
           FROM omni.ChannelConnector cc
           JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
           WHERE ch.TenantId = @tenantId AND cc.DeletedAt IS NULL
         `);

            await transaction.commit();
            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
});

// --- INSTANCES ---
router.get("/instances", async (req, res, next) => {
    try {
        const pool = await getPool();
        const r = await pool.request().query(`
        SELECT 
          cc.ConnectorId, cc.Provider, cc.ConfigJson, cc.WebhookSecret, cc.IsActive, cc.DeletedAt,
          ch.Name as ChannelName, ch.ChannelId,
          t.Name as TenantName, t.TenantId
        FROM omni.ChannelConnector cc
        JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
        JOIN omni.Tenant t ON t.TenantId = ch.TenantId
        WHERE cc.DeletedAt IS NULL
        ORDER BY t.Name, ch.Name
      `);
        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
});

router.get("/tenants/:id/instances", async (req, res, next) => {
    try {
        const tenantId = req.params.id;
        const pool = await getPool();
        const r = await pool.request()
            .input("tid", tenantId)
            .query(`
        SELECT 
          cc.ConnectorId, cc.Provider, cc.ConfigJson, cc.IsActive, cc.DeletedAt,
          ch.Name as ChannelName, ch.ChannelId
        FROM omni.ChannelConnector cc
        JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
        WHERE ch.TenantId = @tid AND cc.DeletedAt IS NULL
        ORDER BY ch.Name
      `);
        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
});

router.post("/instances", validateBody(z.object({
    tenantId: z.string().uuid(),
    provider: z.string(),
    name: z.string().min(2),
    config: z.any()
})), async (req, res, next) => {
    try {
        const body = req.body;
        // Removed direct adapter validation from this file due to decoupling
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const rCh = await transaction.request()
                .input("tenantId", body.tenantId)
                .input("name", body.name)
                .input("type", body.provider === "GTI" ? "WHATSAPP" : body.provider)
                .query(`
          INSERT INTO omni.Channel (TenantId, Name, Type, IsActive)
          OUTPUT inserted.ChannelId
          VALUES (@tenantId, @name, @type, 1)
        `);
            const channelId = rCh.recordset[0].ChannelId;

            const rConn = await transaction.request()
                .input("channelId", channelId)
                .input("provider", body.provider.toUpperCase())
                .input("config", typeof body.config === "string" ? body.config : JSON.stringify(body.config))
                .query(`
          INSERT INTO omni.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson, IsActive)
          OUTPUT inserted.ConnectorId, inserted.WebhookSecret
          VALUES (NEWID(), @channelId, @provider, @config, 1)
        `);

            await transaction.commit();
            res.json({ ok: true, connectorId: rConn.recordset[0].ConnectorId });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
});

router.put("/instances/:connectorId/tenant", validateBody(z.object({ tenantId: z.string().uuid() })), async (req, res, next) => {
    try {
        const { tenantId } = req.body;
        const { connectorId } = req.params;

        const pool = await getPool();
        await pool.request()
            .input("tenantId", tenantId)
            .input("connectorId", connectorId)
            .query(`
        UPDATE ch 
        SET TenantId = @tenantId
        FROM omni.Channel ch
        JOIN omni.ChannelConnector cc ON cc.ChannelId = ch.ChannelId
        WHERE cc.ConnectorId = @connectorId
      `);

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.get("/instances/:connectorId/webhook", async (req, res, next) => {
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
});

router.delete("/instances/:connectorId/webhook/:webhookId", async (req, res, next) => {
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
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.post("/instances/:connectorId/set-webhook", validateBody(z.object({
    webhookBaseUrl: z.string().optional(),
    enabled: z.boolean().optional().default(true),
    events: z.array(z.string()).optional(),
    excludeMessages: z.array(z.string()).optional(),
    addUrlEvents: z.boolean().optional(),
    addUrlTypesMessages: z.boolean().optional()
})), async (req, res, next) => {
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

        const fullWebhookUrl = `${webhookBaseUrl.replace(/\/$/, "")}/api/whatsapp/${provider}/${connectorId}/`;

        await adapter.setWebhook(connector, {
            url: fullWebhookUrl,
            enabled,
            events,
            excludeMessages,
            addUrlEvents,
            addUrlTypesMessages
        });

        res.json({ ok: true, webhookUrl: fullWebhookUrl });
    } catch (error) {
        next(error);
    }
});

router.post("/instances/bulk-delete", validateBody(z.object({ connectorIds: z.array(z.string()) })), async (req, res, next) => {
    try {
        const { connectorIds } = req.body;
        if (!connectorIds.length) return res.json({ ok: true, count: 0 });

        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = transaction.request();
            connectorIds.forEach((id: string, index: number) => {
                request.input(`id${index}`, id);
            });
            const idParams = connectorIds.map((_: string, index: number) => `@id${index}`).join(",");

            await request.query(`
                UPDATE omni.ChannelConnector 
                SET IsActive = 0, DeletedAt = SYSUTCDATETIME()
                WHERE ConnectorId IN (${idParams})
            `);

            await transaction.commit();
            res.json({ ok: true, count: connectorIds.length });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
});

// --- GLOBAL USERS ---
router.get("/users", async (req, res, next) => {
    try {
        const pool = await getPool();
        const r = await pool.request().query(`
      SELECT u.UserId, u.Email, u.Role, u.IsActive, u.TenantId, t.Name as TenantName,
             (SELECT Name FROM omni.Agent a WHERE a.UserId = u.UserId) as AgentName
      FROM omni.[User] u
      LEFT JOIN omni.Tenant t ON t.TenantId = u.TenantId
      ORDER BY u.Email ASC
    `);
        res.json(r.recordset);
    } catch (error) {
        next(error);
    }
});

router.post("/users", validateBody(z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["ADMIN", "AGENT", "SUPERADMIN"]).default("AGENT")
})), async (req, res, next) => {
    try {
        const body = req.body;
        const pool = await getPool();

        // check email
        const check = await pool.request().input("email", body.email).query("SELECT UserId FROM omni.[User] WHERE Email=@email");
        if (check.recordset.length > 0) return res.status(400).json({ error: "Email já cadastrado" });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const hash = await hashPassword(body.password);
            const rUser = await transaction.request()
                .input("tenantId", body.tenantId)
                .input("email", body.email)
                .input("name", body.name)
                .input("hash", hash)
                .input("role", body.role)
                .query(`
          INSERT INTO omni.[User] (TenantId, Email, DisplayName, PasswordHash, Role, IsActive)
          OUTPUT inserted.UserId
          VALUES (@tenantId, @email, @name, @hash, @role, 1)
        `);
            const newUserId = rUser.recordset[0].UserId;

            await transaction.request()
                .input("tenantId", body.tenantId)
                .input("userId", newUserId)
                .input("name", body.name)
                .query(`
          INSERT INTO omni.Agent (TenantId, UserId, Kind, Name, IsActive)
          VALUES (@tenantId, @userId, 'HUMAN', @name, 1)
        `);

            await transaction.commit();
            res.json({ ok: true, userId: newUserId });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
});

router.put("/users/:id", validateBody(z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().optional(),
    role: z.enum(["ADMIN", "AGENT", "SUPERADMIN"]),
    tenantId: z.string().uuid()
})), async (req, res, next) => {
    try {
        const userId = req.params.id;
        const body = req.body;
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            if (body.password) {
                const hash = await hashPassword(body.password);
                await transaction.request()
                    .input("id", userId)
                    .input("tenantId", body.tenantId)
                    .input("email", body.email)
                    .input("name", body.name)
                    .input("role", body.role)
                    .input("hash", hash)
                    .query(`
                        UPDATE omni.[User] 
                        SET Email=@email, DisplayName=@name, Role=@role, PasswordHash=@hash, TenantId=@tenantId
                        WHERE UserId=@id
                    `);
            } else {
                await transaction.request()
                    .input("id", userId)
                    .input("tenantId", body.tenantId)
                    .input("email", body.email)
                    .input("name", body.name)
                    .input("role", body.role)
                    .query(`
                        UPDATE omni.[User] 
                        SET Email=@email, DisplayName=@name, Role=@role, TenantId=@tenantId
                        WHERE UserId=@id
                    `);
            }

            await transaction.request()
                .input("id", userId)
                .input("tenantId", body.tenantId)
                .input("name", body.name)
                .query(`
                    UPDATE omni.Agent 
                    SET Name=@name, TenantId=@tenantId
                    WHERE UserId=@id
                `);

            await transaction.commit();
            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error: any) {
        if (error.code === 'EREQUEST' && error.message.includes('UK_User_Email')) {
            return res.status(400).json({ error: "Email já cadastrado." });
        }
        next(error);
    }
});

router.put("/users/:id/status", validateBody(z.object({ isActive: z.boolean() })), async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { isActive } = req.body;
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request()
                .input("id", userId)
                .input("active", isActive ? 1 : 0)
                .query("UPDATE omni.[User] SET IsActive=@active WHERE UserId=@id");

            await transaction.request()
                .input("id", userId)
                .input("active", isActive ? 1 : 0)
                .query("UPDATE omni.Agent SET IsActive=@active WHERE UserId=@id");

            await transaction.commit();
            res.json({ ok: true });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        next(error);
    }
});

// --- GTI ---
router.get("/instances/gti-info", async (req, res, next) => {
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
});

export default router;
