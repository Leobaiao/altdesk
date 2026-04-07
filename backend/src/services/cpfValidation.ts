import { getPool } from "../db.js";
import { logger } from "../lib/logger.js";

/** Session expiration in minutes — sessions older than this are ignored */
const SESSION_TTL_MINUTES = 30;

/**
 * Valida o formato do CPF (aceita com ou sem pontuação).
 */
export function isValidCpfFormat(cpf: string): boolean {
    const cleaned = cpf.replace(/[.\-]/g, "");
    if (cleaned.length !== 11 || /^(\d)\1+$/.test(cleaned)) return false;

    // Validação dos dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
    let remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== parseInt(cleaned[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== parseInt(cleaned[10])) return false;

    return true;
}

/**
 * Busca um contato pelo CPF no tenant.
 */
export async function findContactByCpf(tenantId: string, cpf: string) {
    const pool = await getPool();
    const cleaned = cpf.replace(/[.\-]/g, "");
    const r = await pool.request()
        .input("tenantId", tenantId)
        .input("cpf", cleaned)
        .query(`
      SELECT ContactId, Name, Phone, CPF, Email
      FROM altdesk.Contact
      WHERE TenantId = @tenantId AND REPLACE(REPLACE(CPF, '.', ''), '-', '') = @cpf
    `);
    return r.recordset.length > 0 ? r.recordset[0] : null;
}

/**
 * Busca um usuário (técnico/supervisor/gerente) pelo CPF no tenant.
 */
export async function findUserByCpf(tenantId: string, cpf: string) {
    const pool = await getPool();
    const cleaned = cpf.replace(/[.\-]/g, "");
    const r = await pool.request()
        .input("tenantId", tenantId)
        .input("cpf", cleaned)
        .query(`
      SELECT UserId, Email, Role, CPF
      FROM altdesk.[User]
      WHERE TenantId = @tenantId AND REPLACE(REPLACE(CPF, '.', ''), '-', '') = @cpf AND IsActive = 1
    `);
    return r.recordset.length > 0 ? r.recordset[0] : null;
}

/**
 * Cria um contato novo com CPF.
 */
export async function createContactWithCpf(tenantId: string, data: { name: string; phone: string; cpf: string; email?: string }) {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .input("name", data.name)
        .input("phone", data.phone)
        .input("cpf", data.cpf.replace(/[.\-]/g, ""))
        .input("email", data.email ?? null)
        .query(`
      INSERT INTO altdesk.Contact (TenantId, Name, Phone, CPF, Email)
      OUTPUT inserted.ContactId
      VALUES (@tenantId, @name, @phone, @cpf, @email)
    `);
    return r.recordset[0].ContactId;
}

// ─── Session Management (Database-backed) ──────────────────────

type CpfStep = "AWAITING_CPF" | "AWAITING_NAME" | "AWAITING_EMAIL";

interface CpfSession {
    tenantId: string;
    externalUserId: string;
    step: CpfStep;
    partialData: Record<string, any>;
}

/**
 * Verifica se a sessão está pendente de CPF para um determinado externalUserId.
 * Ignora sessões expiradas (mais de SESSION_TTL_MINUTES minutos).
 */
export async function getPendingCpfSession(externalUserId: string): Promise<CpfSession | null> {
    const pool = await getPool();
    const r = await pool.request()
        .input("externalUserId", externalUserId)
        .input("ttlMinutes", SESSION_TTL_MINUTES)
        .query(`
            SELECT ExternalUserId, TenantId, Step, PartialDataJson
            FROM altdesk.CpfSession
            WHERE ExternalUserId = @externalUserId
              AND DATEDIFF(MINUTE, UpdatedAt, SYSUTCDATETIME()) < @ttlMinutes
        `);

    if (r.recordset.length === 0) return null;

    const row = r.recordset[0];
    return {
        tenantId: row.TenantId,
        externalUserId: row.ExternalUserId,
        step: row.Step as CpfStep,
        partialData: row.PartialDataJson ? JSON.parse(row.PartialDataJson) : {},
    };
}

/**
 * Inicia uma sessão de validação de CPF (UPSERT).
 */
export async function startCpfSession(externalUserId: string, tenantId: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
        .input("externalUserId", externalUserId)
        .input("tenantId", tenantId)
        .input("step", "AWAITING_CPF")
        .query(`
            MERGE altdesk.CpfSession AS target
            USING (SELECT @externalUserId AS ExternalUserId) AS source
            ON target.ExternalUserId = source.ExternalUserId
            WHEN MATCHED THEN
                UPDATE SET TenantId = @tenantId, Step = @step, PartialDataJson = NULL, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (ExternalUserId, TenantId, Step, PartialDataJson)
                VALUES (@externalUserId, @tenantId, @step, NULL);
        `);
}

/**
 * Atualiza a sessão de CPF com dados parciais.
 */
export async function updateCpfSession(externalUserId: string, step: CpfStep, data: Record<string, any>): Promise<void> {
    const pool = await getPool();

    // Merge existing partial data with new data
    const existing = await getPendingCpfSession(externalUserId);
    const merged = { ...(existing?.partialData || {}), ...data };

    await pool.request()
        .input("externalUserId", externalUserId)
        .input("step", step)
        .input("partialDataJson", JSON.stringify(merged))
        .query(`
            UPDATE altdesk.CpfSession
            SET Step = @step, PartialDataJson = @partialDataJson, UpdatedAt = SYSUTCDATETIME()
            WHERE ExternalUserId = @externalUserId
        `);
}

/**
 * Remove a sessão de CPF após conclusão.
 */
export async function clearCpfSession(externalUserId: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
        .input("externalUserId", externalUserId)
        .query(`DELETE FROM altdesk.CpfSession WHERE ExternalUserId = @externalUserId`);
}

/**
 * Processa a mensagem do usuário dentro do fluxo de validação de CPF.
 * Retorna uma mensagem de resposta se ainda estiver no fluxo, ou null se a validação terminou.
 */
export async function processCpfValidationFlow(
    tenantId: string,
    externalUserId: string,
    phone: string,
    messageText: string
): Promise<{ response: string; completed: boolean; contactId?: string }> {
    const session = await getPendingCpfSession(externalUserId);

    if (!session) {
        await startCpfSession(externalUserId, tenantId);
        return {
            response: "Olá, você está no helpdesk da nossa empresa. Por favor, digite seu CPF...\n(Se não souber, digite NÃO SEI).",
            completed: false
        };
    }

    if (session.step === "AWAITING_CPF") {
        const cpfText = messageText.trim().toUpperCase();
        
        if (cpfText === "NÃO SEI" || cpfText === "NAO SEI") {
            await updateCpfSession(externalUserId, "AWAITING_NAME", { phone });
            return {
                response: "Sem problemas. Vamos criar um cadastro manual.\n📝 Por favor, informe seu *nome completo*:",
                completed: false
            };
        }

        const cpf = cpfText;
        if (!isValidCpfFormat(cpf)) {
            return {
                response: "❌ CPF inválido. Por favor, informe um CPF válido (ex: 000.000.000-00):",
                completed: false
            };
        }

        // Verificar se já existe
        const existingContact = await findContactByCpf(tenantId, cpf);
        if (existingContact) {
            await clearCpfSession(externalUserId);
            return {
                response: `✅ Identificamos seu cadastro, *${existingContact.Name}*!`,
                completed: true,
                contactId: existingContact.ContactId
            };
        }

        // Verificar se é um usuário interno
        const existingUser = await findUserByCpf(tenantId, cpf);
        if (existingUser) {
            await clearCpfSession(externalUserId);
            return {
                response: `✅ Olá! Você foi identificado como usuário do sistema (${existingUser.Email}). Como posso ajudá-lo?`,
                completed: true
            };
        }

        // CPF não encontrado, pedir nome
        await updateCpfSession(externalUserId, "AWAITING_NAME", { cpf, phone });
        return {
            response: "CPF não encontrado no sistema. Vamos criar seu cadastro.\n📝 Por favor, informe seu *nome completo*:",
            completed: false
        };
    }

    if (session.step === "AWAITING_NAME") {
        const name = messageText.trim();
        if (name.length < 3) {
            return {
                response: "❌ Nome muito curto. Por favor, informe seu nome completo:",
                completed: false
            };
        }

        await updateCpfSession(externalUserId, "AWAITING_EMAIL", { name });
        return {
            response: "📧 Por favor, informe seu *e-mail* (ou digite \"pular\" se não tiver):",
            completed: false
        };
    }

    if (session.step === "AWAITING_EMAIL") {
        const emailText = messageText.trim().toLowerCase();
        const email = emailText === "pular" || emailText === "skip" ? undefined : emailText;

        const contactId = await createContactWithCpf(tenantId, {
            name: session.partialData.name,
            phone: session.partialData.phone || phone,
            cpf: session.partialData.cpf,
            email
        });

        await clearCpfSession(externalUserId);
        return {
            response: `✅ Cadastro realizado com sucesso, *${session.partialData.name}*!`,
            completed: true,
            contactId
        };
    }

    // Fallback – não deveria chegar aqui
    await clearCpfSession(externalUserId);
    return {
        response: "Ocorreu um erro no processo. Por favor, envie uma nova mensagem para recomeçar.",
        completed: true
    };
}
