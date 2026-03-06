import "dotenv/config";
import { getPool } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

async function main() {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        console.error("Uso: npx tsx scripts/create_sysadmin.ts <email> <password>");
        process.exit(1);
    }

    console.log(`Criando/Atualizando SUPERADMIN: ${email}...`);

    try {
        const pool = await getPool();
        const hash = await hashPassword(password);

        // 1. Check if user exists
        const check = await pool.request()
            .input("email", email)
            .query("SELECT UserId, TenantId FROM omni.[User] WHERE Email=@email");

        if (check.recordset.length > 0) {
            // Update existing
            console.log("Usuário já existe. Atualizando senha e role...");
            await pool.request()
                .input("email", email)
                .input("hash", hash)
                .query("UPDATE omni.[User] SET Role='SUPERADMIN', PasswordHash=@hash WHERE Email=@email");
            console.log("Usuário atualizado com sucesso!");
        } else {
            // Create new
            console.log("Criando novo usuário...");

            // Get Default Tenant
            const t = await pool.request().query("SELECT TOP 1 TenantId FROM omni.Tenant");
            if (t.recordset.length === 0) throw new Error("Nenhum Tenant encontrado! Rode o seed primeiro.");
            const tenantId = t.recordset[0].TenantId;

            const r = await pool.request()
                .input("tenantId", tenantId)
                .input("email", email)
                .input("hash", hash)
                .input("displayName", "Super Admin")
                .query(`
          INSERT INTO omni.[User] (TenantId, Email, DisplayName, PasswordHash, Role)
          OUTPUT inserted.UserId
          VALUES (@tenantId, @email, @displayName, @hash, 'SUPERADMIN')
        `);

            const userId = r.recordset[0].UserId;

            // Create Agent Profile
            await pool.request()
                .input("tenantId", tenantId)
                .input("userId", userId)
                .input("name", "Super Admin")
                .query(`
          INSERT INTO omni.Agent (TenantId, UserId, Kind, Name)
          VALUES (@tenantId, @userId, 'HUMAN', @name)
        `);

            console.log("Usuário criado com sucesso!");
        }

    } catch (e: any) {
        console.error("Erro:", e.message);
    } finally {
        process.exit(0);
    }
}

main();
