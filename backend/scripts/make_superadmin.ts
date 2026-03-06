import "dotenv/config";
import { getPool } from "../src/db.js";

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Uso: npx tsx scripts/make_superadmin.ts <email>");
        process.exit(1);
    }

    console.log(`Promovendo ${email} a SUPERADMIN...`);

    try {
        const pool = await getPool();
        const r = await pool.request()
            .input("email", email)
            .query("UPDATE omni.[User] SET Role='SUPERADMIN' WHERE Email=@email");

        if (r.rowsAffected[0] === 0) {
            console.error("Usuário não encontrado!");
        } else {
            console.log("Sucesso! Agora esse usuário é SUPERADMIN.");
        }
    } catch (e: any) {
        console.error("Erro:", e.message);
    } finally {
        process.exit(0);
    }
}

main();
