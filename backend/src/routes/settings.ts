import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { authMw, requireRole, requirePermission } from "../mw.js";
import { validateBody } from "../middleware/validateMw.js";
import { listTenantInstances, assignUsersToInstance } from "../services/instanceService.js";
import { purgeTenantDemoData } from "../services/tenantService.js";
import { writeAuditLog, extractRequestInfo } from "../services/auditLog.js";

const router = Router();
router.use(authMw, requirePermission('settings'), requireRole("ADMIN", "SUPERADMIN"));

router.get("/", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();

        const tenant = await pool.request()
            .input("tenantId", user.tenantId)
            .query("SELECT DefaultProvider FROM altdesk.Tenant WHERE TenantId=@tenantId");
        const defaultProvider = tenant.recordset[0]?.DefaultProvider || "GTI";

        const rawInstances = await listTenantInstances(user.tenantId);

        // Parsear ConfigJson para o frontend
        const instances = rawInstances.map((inst: any) => {
            let config = {};
            try { config = JSON.parse(inst.ConfigJson || "{}"); } catch { }
            return { ...inst, config, ConfigJson: undefined };
        });

        // Set default config if the current default provider has an active instance
        let config = {};
        const activeDefault = instances.find((i: any) => i.Provider === defaultProvider && i.IsActive);
        
        if (activeDefault) {
            config = activeDefault.config;
        } else if (instances.length > 0) {
            config = instances[0].config;
        }

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
            .query("UPDATE altdesk.Tenant SET DefaultProvider=@provider WHERE TenantId=@tenantId");

        if (body.connectorId) {
            const current = await pool.request()
                .input("tenantId", user.tenantId)
                .input("connectorId", body.connectorId)
                .query(`
            SELECT TOP 1 cc.ConnectorId, cc.ConfigJson
            FROM altdesk.ChannelConnector cc
            JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
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
                        .query(`UPDATE altdesk.ChannelConnector SET ConfigJson=@config WHERE ConnectorId=@connectorId`)
                } catch { }
            }
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

/**
 * Testa a conexão com a instância do WhatsApp (Evolution API)
 */
router.post("/instances/:connectorId/test", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();
        const { connectorId } = req.params;

        const current = await pool.request()
            .input("tenantId", user.tenantId)
            .input("connectorId", connectorId)
            .query(`
                SELECT TOP 1 cc.ConnectorId, cc.ConfigJson, cc.Provider
                FROM altdesk.ChannelConnector cc
                JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
                WHERE ch.TenantId=@tenantId AND cc.ConnectorId=@connectorId AND cc.DeletedAt IS NULL
            `);

        if (current.recordset.length === 0) {
            return res.status(404).json({ error: "Instância não encontrada." });
        }

        const conn = current.recordset[0];
        let conf: any = {};
        try { conf = JSON.parse(conn.ConfigJson); } catch {}

        if (conn.Provider === 'WHATSAPP' || conn.Provider === 'GTI' || conn.Provider === 'ZAPI' || conn.Provider === 'OFFICIAL') {
            const baseUrl = conf.baseUrl || "";
            const apiKey = conf.apiKey || conf.accessToken || conf.token || "";
            const instanceName = conf.instance || conf.phoneNumberId || "";

            if (!baseUrl || !instanceName) {
                return res.status(400).json({ error: "Configuração incompleta. Preencha URL e Instância." });
            }

            try {
                const url = `${baseUrl.replace(/\/$/, '')}/instance/connectionState/${instanceName}`;
                const fetchRes = await fetch(url, {
                    headers: { 'apikey': apiKey }
                });

                if (!fetchRes.ok) {
                    return res.status(fetchRes.status).json({ error: "Erro na API: " + fetchRes.statusText });
                }

                const data = await fetchRes.json();
                return res.json({ ok: true, connectionState: data });
            } catch (err: any) {
                return res.status(500).json({ error: "Falha ao conectar: " + err.message });
            }
        }

        return res.json({ ok: true, msg: "Testes para este provedor (ainda) não suportados." });
    } catch (error) {
        next(error);
    }
});

/**
 * Atribui funcionários a uma instância
 */
router.post("/instances/:connectorId/assignments", validateBody(z.object({
    userIds: z.array(z.string().uuid())
})), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();
        const { connectorId } = req.params;
        let { userIds } = req.body;

        // Verificar que o connector pertence ao tenant do admin
        const check = await pool.request()
            .input("connectorId", connectorId)
            .input("tenantId", user.tenantId)
            .query(`
                SELECT 1 FROM altdesk.ChannelConnector cc
                JOIN altdesk.Channel ch ON ch.ChannelId = cc.ChannelId
                WHERE cc.ConnectorId = @connectorId AND ch.TenantId = @tenantId AND cc.DeletedAt IS NULL
            `);
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: "Instância não encontrada." });
        }
        // Validated at line 112: userIds is z.array(z.string().uuid()) and connectorId is a route param
        // This input is already sanitized by the Zod middleware
        await assignUsersToInstance(connectorId, userIds, user.tenantId);

        // Auditoria
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'ASSIGN_INSTANCE_USERS',
            targetTable: 'InstanceAssignment',
            targetId: connectorId,
            afterValues: { userIds }
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

/**
 * Configurações Gerais do Tenant (Kanban, Timezone, etc.)
 */
router.get("/tenant", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();
        const result = await pool.request()
            .input("tenantId", user.tenantId)
            .query("SELECT * FROM altdesk.TenantSettings WHERE TenantId=@tenantId");
        
        if (result.recordset.length === 0) {
            return res.json({
                KanbanColumnsJson: JSON.stringify({
                    NEW: 'Novo',
                    TRIAGE: 'Triagem',
                    IN_PROGRESS: 'Em atendimento',
                    WAITING_CUSTOMER: 'Aguardando cliente',
                    WAITING_THIRD_PARTY: 'Aguardando terceiro',
                    ESCALATED: 'Escalado',
                    RESOLVED: 'Resolvido'
                }),
                Timezone: 'America/Sao_Paulo'
            });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        next(error);
    }
});

router.put("/tenant", validateBody(z.object({
    kanbanColumns: z.record(z.string()).optional(),
    timezone: z.string().optional()
})), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const { kanbanColumns, timezone } = req.body;
        const pool = await getPool();

        await pool.request()
            .input("tenantId", user.tenantId)
            .input("kanban", kanbanColumns ? JSON.stringify(kanbanColumns) : null)
            .input("tz", timezone || null)
            .query(`
                IF EXISTS (SELECT 1 FROM altdesk.TenantSettings WHERE TenantId=@tenantId)
                    UPDATE altdesk.TenantSettings 
                    SET KanbanColumnsJson = ISNULL(@kanban, KanbanColumnsJson), 
                        Timezone = ISNULL(@tz, Timezone), 
                        UpdatedAt = SYSUTCDATETIME() 
                    WHERE TenantId=@tenantId
                ELSE
                    INSERT INTO altdesk.TenantSettings (TenantId, KanbanColumnsJson, Timezone) 
                    VALUES (@tenantId, ISNULL(@kanban, '{}'), ISNULL(@tz, 'America/Sao_Paulo'))
            `);
        
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

/**
 * Limpeza de Dados (Pós-Avaliação)
 */
router.post("/tenant/cleanup", async (req, res, next) => {
    try {
        const user = (req as any).user;
        await purgeTenantDemoData(user.tenantId);
        res.json({ ok: true, message: "Dados de teste limpos com sucesso." });
    } catch (error) {
        next(error);
    }
});

/**
 * Extensão de Avaliação (Trial)
 * Usado quando a conta expira e o usuário clica em "Estender Avaliação"
 */
router.post("/extend-trial", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();
        
        // Adds 7 days to the trial
        await pool.request()
            .input("tenantId", user.tenantId)
            .query(`
                UPDATE altdesk.Subscription 
                SET ExpiresAt = DATEADD(day, 7, SYSUTCDATETIME())
                WHERE TenantId = @tenantId AND PlanCode = 'TRIAL'
            `);
            
        res.json({ ok: true, message: "Período de avaliação estendido por 7 dias." });
    } catch (error) {
        next(error);
    }
});

/**
 * CRUD de Políticas de SLA
 */
router.get("/sla", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const pool = await getPool();
        const result = await pool.request()
            .input("tenantId", user.tenantId)
            .query("SELECT * FROM altdesk.SLAPolicy WHERE TenantId=@tenantId ORDER BY CreatedAt ASC");
        res.json(result.recordset);
    } catch (error) {
        next(error);
    }
});

const slaSchema = z.object({
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT']),
    firstResponseMinutes: z.number().min(0),
    resolutionMinutes: z.number().min(0),
    warningBeforeMinutes: z.number().min(0).default(10),
    businessHoursOnly: z.boolean().default(false)
});

router.post("/sla", validateBody(slaSchema), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const body = req.body;
        const pool = await getPool();

        // Check if priority already exists for tenant
        const check = await pool.request()
            .input("tenantId", user.tenantId)
            .input("priority", body.priority)
            .query("SELECT 1 FROM altdesk.SLAPolicy WHERE TenantId=@tenantId AND Priority=@priority");
        
        if (check.recordset.length > 0) {
            return res.status(400).json({ error: "SLA Policy para esta prioridade já existe." });
        }

        const result = await pool.request()
            .input("tenantId", user.tenantId)
            .input("priority", body.priority)
            .input("first", body.firstResponseMinutes)
            .input("res", body.resolutionMinutes)
            .input("warn", body.warningBeforeMinutes)
            .input("biz", body.businessHoursOnly)
            .query(`
                INSERT INTO altdesk.SLAPolicy (TenantId, Priority, FirstResponseMinutes, ResolutionMinutes, WarningBeforeMinutes, BusinessHoursOnly)
                OUTPUT INSERTED.*
                VALUES (@tenantId, @priority, @first, @res, @warn, @biz)
            `);
        
        // Auditoria
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'CREATE_SLA_POLICY',
            targetTable: 'SLAPolicy',
            targetId: result.recordset[0].PolicyId,
            afterValues: body
        });

        res.json(result.recordset[0]);
    } catch (error) {
        next(error);
    }
});

router.put("/sla/:id", validateBody(slaSchema), async (req, res, next) => {
    try {
        const user = (req as any).user;
        const id = req.params.id;
        const body = req.body;
        const pool = await getPool();

        const check = await pool.request()
            .input("tenantId", user.tenantId)
            .input("id", id)
            .query("SELECT * FROM altdesk.SLAPolicy WHERE PolicyId=@id AND TenantId=@tenantId");
        
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: "Política de SLA não encontrada." });
        }
        
        // Ensure priority doesn't collide with another policy
        if (check.recordset[0].Priority !== body.priority) {
            const collide = await pool.request()
                .input("tenantId", user.tenantId)
                .input("priority", body.priority)
                .query("SELECT 1 FROM altdesk.SLAPolicy WHERE TenantId=@tenantId AND Priority=@priority");
            if (collide.recordset.length > 0) {
                return res.status(400).json({ error: "SLA Policy para esta prioridade já existe." });
            }
        }

        const result = await pool.request()
            .input("id", id)
            .input("tenantId", user.tenantId)
            .input("priority", body.priority)
            .input("first", body.firstResponseMinutes)
            .input("res", body.resolutionMinutes)
            .input("warn", body.warningBeforeMinutes)
            .input("biz", body.businessHoursOnly)
            .query(`
                UPDATE altdesk.SLAPolicy
                SET Priority=@priority, FirstResponseMinutes=@first, ResolutionMinutes=@res, WarningBeforeMinutes=@warn, BusinessHoursOnly=@biz, UpdatedAt=SYSUTCDATETIME()
                OUTPUT INSERTED.*
                WHERE PolicyId=@id AND TenantId=@tenantId
            `);
        
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'UPDATE_SLA_POLICY',
            targetTable: 'SLAPolicy',
            targetId: id,
            beforeValues: check.recordset[0],
            afterValues: body
        });

        res.json(result.recordset[0]);
    } catch (error) {
        next(error);
    }
});

router.delete("/sla/:id", async (req, res, next) => {
    try {
        const user = (req as any).user;
        const id = req.params.id;
        const pool = await getPool();

        const check = await pool.request()
            .input("tenantId", user.tenantId)
            .input("id", id)
            .query("SELECT * FROM altdesk.SLAPolicy WHERE PolicyId=@id AND TenantId=@tenantId");
        
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: "Política de SLA não encontrada." });
        }

        await pool.request()
            .input("id", id)
            .input("tenantId", user.tenantId)
            .query("DELETE FROM altdesk.SLAPolicy WHERE PolicyId=@id AND TenantId=@tenantId");
        
        const reqInfo = extractRequestInfo(req);
        writeAuditLog({
            ...reqInfo,
            action: 'DELETE_SLA_POLICY',
            targetTable: 'SLAPolicy',
            targetId: id,
            beforeValues: check.recordset[0]
        });

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export default router;
