import sql from "mssql";
import { getPool } from "../db.js";
import { hashPassword } from "../auth.js";

/**
 * Interface para criação de usuário
 */
export interface CreateUserData {
    tenantId: string;
    name: string;
    email: string;
    passwordRaw: string;
    role: "ADMIN" | "AGENT" | "SUPERADMIN";
}

/**
 * Lista todos os usuários globais
 */
export async function listAllUsers() {
    const pool = await getPool();
    return (await pool.request().query(`
    SELECT u.UserId, u.Email, u.Role, u.IsActive, u.TenantId, t.Name as TenantName, u.DisplayName,
           (SELECT Name FROM altdesk.Agent a WHERE a.UserId = u.UserId) as AgentName
    FROM altdesk.[User] u
    LEFT JOIN altdesk.Tenant t ON t.TenantId = u.TenantId
    WHERE u.DeletedAt IS NULL
    ORDER BY u.Email ASC
  `)).recordset;
}

/**
 * Cria usuário e agente correspondente (Transacional)
 */
export async function createGlobalUser(data: CreateUserData) {
    const pool = await getPool();

    // check email duplication
    const check = await pool.request().input("email", data.email).query("SELECT UserId FROM altdesk.[User] WHERE Email=@email");
    if (check.recordset.length > 0) throw new Error("Email já cadastrado");

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const hash = await hashPassword(data.passwordRaw);
        const rUser = await transaction.request()
            .input("tenantId", data.tenantId)
            .input("email", data.email)
            .input("name", data.name)
            .input("hash", hash)
            .input("role", data.role)
            .query(`
          INSERT INTO altdesk.[User] (TenantId, Email, DisplayName, PasswordHash, Role, IsActive)
          OUTPUT inserted.UserId
          VALUES (@tenantId, @email, @name, @hash, @role, 1)
        `);
        const newUserId = rUser.recordset[0].UserId;

        await transaction.request()
            .input("tenantId", data.tenantId)
            .input("userId", newUserId)
            .input("name", data.name)
            .query(`
          INSERT INTO altdesk.Agent (TenantId, UserId, Kind, Name, IsActive)
          VALUES (@tenantId, @userId, 'HUMAN', @name, 1)
        `);

        await transaction.commit();
        return newUserId;
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

/**
 * Atualiza dados do usuário (Email, Nome, Role, Tenant e opcionalmente Senha)
 */
export async function updateGlobalUser(userId: string, data: Partial<CreateUserData>) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const request = transaction.request()
            .input("id", userId)
            .input("tenantId", data.tenantId)
            .input("email", data.email)
            .input("name", data.name)
            .input("role", data.role);

        if (data.passwordRaw) {
            const hash = await hashPassword(data.passwordRaw);
            await request
                .input("hash", hash)
                .query(`
            UPDATE altdesk.[User] 
            SET Email=@email, DisplayName=@name, Role=@role, PasswordHash=@hash, TenantId=@tenantId
            WHERE UserId=@id
          `);
        } else {
            await request.query(`
        UPDATE altdesk.[User] 
        SET Email=@email, DisplayName=@name, Role=@role, TenantId=@tenantId
        WHERE UserId=@id
      `);
        }

        await transaction.request()
            .input("id", userId)
            .input("tenantId", data.tenantId)
            .input("name", data.name)
            .query(`
            UPDATE altdesk.Agent 
            SET Name=@name, TenantId=@tenantId
            WHERE UserId=@id;

            IF @@ROWCOUNT = 0
            BEGIN
              INSERT INTO altdesk.Agent (TenantId, UserId, Kind, Name, IsActive)
              VALUES (@tenantId, @id, 'HUMAN', @name, 1);
            END
        `);

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

/**
 * Ativa ou Desativa usuário e agente
 */
export async function setUserActiveStatus(userId: string, isActive: boolean) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const activeBit = isActive ? 1 : 0;

    try {
        await transaction.request()
            .input("id", userId)
            .input("active", activeBit)
            .query("UPDATE altdesk.[User] SET IsActive=@active WHERE UserId=@id");

        await transaction.request()
            .input("id", userId)
            .input("active", activeBit)
            .query("UPDATE altdesk.Agent SET IsActive=@active WHERE UserId=@id");

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

/**
 * Lista usuários na lixeira
 */
export async function listDeletedUsers() {
    const pool = await getPool();
    return (await pool.request().query(`
        SELECT u.UserId, u.Email, u.Role, u.DeletedAt, u.TenantId, t.Name as TenantName, u.DisplayName,
               (SELECT Name FROM altdesk.Agent a WHERE a.UserId = u.UserId) as AgentName
        FROM altdesk.[User] u
        LEFT JOIN altdesk.Tenant t ON t.TenantId = u.TenantId
        WHERE u.DeletedAt IS NOT NULL
        ORDER BY u.DeletedAt DESC
    `)).recordset;
}

/**
 * Restaura um usuário da lixeira
 */
export async function restoreUser(userId: string) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        await transaction.request()
            .input("id", userId)
            .query("UPDATE altdesk.[User] SET DeletedAt = NULL, IsActive = 1 WHERE UserId = @id");

        await transaction.request()
            .input("id", userId)
            .query("UPDATE altdesk.Agent SET IsActive = 1 WHERE UserId = @id");

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }

}

/**
 * Lista usuários de um tenant específico
 */
export async function listTenantUsers(tenantId: string) {
    const pool = await getPool();
    return (await pool.request()
        .input("tenantId", tenantId)
        .query(`
        SELECT u.UserId, u.Email, u.Role, u.IsActive, u.CreatedAt, u.DisplayName,
               (SELECT Name FROM altdesk.Agent a WHERE a.UserId = u.UserId) as AgentName
        FROM altdesk.[User] u
        WHERE u.TenantId = @tenantId AND u.DeletedAt IS NULL
        ORDER BY u.CreatedAt DESC
    `)).recordset;
}


