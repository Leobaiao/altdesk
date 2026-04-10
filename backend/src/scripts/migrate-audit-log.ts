import sql from "mssql";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const rawHost = process.env.DB_HOST || "localhost";
const hostParts = rawHost.split(",");
const server = hostParts[0];
const port = hostParts[1] ? parseInt(hostParts[1], 10) : (process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433);

const config = {
    user: process.env.DB_USER!,
    password: process.env.DB_PASS!,
    server,
    port,
    database: process.env.DB_NAME!,
    options: { encrypt: false, trustServerCertificate: true },
};

async function migrate() {
    console.log("Iniciando migração da tabela AuditLog...");
    
    try {
        const pool = await sql.connect(config);
        console.log("Conectado ao banco de dados");
        
        // 1. Renomear colunas existentes se elas existirem com os nomes antigos
        const checkColumns = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'altdesk' AND TABLE_NAME = 'AuditLog'
        `);
        const columns = checkColumns.recordset.map(c => c.COLUMN_NAME);

        if (columns.includes('Entity') && !columns.includes('TargetTable')) {
            console.log("Renomeando Entity para TargetTable...");
            await pool.request().query("EXEC sp_rename 'altdesk.AuditLog.Entity', 'TargetTable', 'COLUMN'");
        }
        if (columns.includes('EntityId') && !columns.includes('TargetId')) {
            console.log("Renomeando EntityId para TargetId...");
            await pool.request().query("EXEC sp_rename 'altdesk.AuditLog.EntityId', 'TargetId', 'COLUMN'");
        }
        if (columns.includes('PreviousData') && !columns.includes('BeforeValues')) {
            console.log("Renomeando PreviousData para BeforeValues...");
            await pool.request().query("EXEC sp_rename 'altdesk.AuditLog.PreviousData', 'BeforeValues', 'COLUMN'");
        }
        if (columns.includes('NewData') && !columns.includes('AfterValues')) {
            console.log("Renomeando NewData para AfterValues...");
            await pool.request().query("EXEC sp_rename 'altdesk.AuditLog.NewData', 'AfterValues', 'COLUMN'");
        }

        // 2. Adicionar novas colunas se não existirem
        if (!columns.includes('IpAddress')) {
            console.log("Adicionando coluna IpAddress...");
            await pool.request().query("ALTER TABLE altdesk.AuditLog ADD IpAddress NVARCHAR(50) NULL");
        }
        if (!columns.includes('UserAgent')) {
            console.log("Adicionando coluna UserAgent...");
            await pool.request().query("ALTER TABLE altdesk.AuditLog ADD UserAgent NVARCHAR(MAX) NULL");
        }

        // 3. Tornar TenantId anulável
        console.log("Tornando TenantId anulável...");
        await pool.request().query("ALTER TABLE altdesk.AuditLog ALTER COLUMN TenantId UNIQUEIDENTIFIER NULL");

        console.log("Migração concluída com sucesso!");
        await pool.close();
    } catch (err) {
        console.error("Erro na migração do AuditLog:", err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

migrate();
