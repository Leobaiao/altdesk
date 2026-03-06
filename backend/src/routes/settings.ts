import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { authMw, requireRole } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";

const router = Router();
router.use(authMw, requireRole("ADMIN", "SUPERADMIN"));

router.get("/", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();

        const t = await pool.request()
            .input("tenantId", user.tenantId)
            .query("SELECT DefaultProvider FROM omni.Tenant WHERE TenantId=@tenantId");
        const defaultProvider = t.recordset[0]?.DefaultProvider || "GTI";

        const c = await pool.request()
            .input("tenantId", user.tenantId)
            .query(`
        SELECT cc.ConnectorId, cc.Provider, cc.ConfigJson, cc.IsActive, ch.Name as ChannelName
        FROM omni.ChannelConnector cc
        JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
        WHERE ch.TenantId=@tenantId AND cc.DeletedAt IS NULL
      `);

        const instances = c.recordset.map((row: any) => {
            let config = {};
            try { config = JSON.parse(row.ConfigJson); } catch { }
            return { ...row, config, ConfigJson: undefined };
        });

        // Set default config if the current default provider has an active instance
        let config = {};
        const activeDefault = instances.find((i: any) => i.Provider === defaultProvider && i.IsActive);
        if (activeDefault) config = activeDefault.config;
        else if (instances.length > 0) config = instances[0].config;

        res.json({ defaultProvider, config, instances });
    } catch (error) {
        next(error);
    }
});

router.put("/", validateBody(z.object({
    defaultProvider: z.string(),
    connectorId: z.string().uuid().optional(),
    instanceId: z.string().optional(),
    token: z.string().optional()
})), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const body = req.body;
        const pool = await getPool();

        await pool.request()
            .input("tenantId", user.tenantId)
            .input("provider", body.defaultProvider)
            .query("UPDATE omni.Tenant SET DefaultProvider=@provider WHERE TenantId=@tenantId");

        if (body.connectorId) {
            const current = await pool.request()
                .input("tenantId", user.tenantId)
                .input("connectorId", body.connectorId)
                .query(`
            SELECT TOP 1 cc.ConnectorId, cc.ConfigJson
            FROM omni.ChannelConnector cc
            JOIN omni.Channel ch ON ch.ChannelId = cc.ChannelId
            WHERE ch.TenantId=@tenantId AND cc.ConnectorId=@connectorId AND cc.DeletedAt IS NULL
          `);

            let configJson = "{}";

            if (current.recordset.length > 0) {
                try {
                    const conf = JSON.parse(current.recordset[0].ConfigJson);
                    if (body.instanceId) conf.instance = body.instanceId;
                    if (body.token) conf.token = body.token;

                    // Support different fields per provider dynamically
                    if (body.defaultProvider === 'OFFICIAL') {
                        if (body.token) conf.accessToken = body.token;
                        if (body.instanceId) conf.phoneNumberId = body.instanceId;
                    } else if (body.defaultProvider === 'WHATSAPP') {
                        if (body.instanceId) conf.phoneNumberId = body.instanceId;
                        if (body.token) conf.accessToken = body.token;
                    } else if (body.defaultProvider === 'GTI' || body.defaultProvider === 'ZAPI') {
                        if (body.token) conf.apiKey = body.token;
                    }

                    configJson = JSON.stringify(conf);

                    await pool.request()
                        .input("config", configJson)
                        .input("connectorId", current.recordset[0].ConnectorId)
                        .query(`UPDATE omni.ChannelConnector SET ConfigJson=@config WHERE ConnectorId=@connectorId`)
                } catch { }
            }
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export default router;
