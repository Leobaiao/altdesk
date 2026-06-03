import "dotenv/config";
import pkg from "mssql";
const { connect } = pkg;

const config = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASS || process.env.MSSQL_SA_PASSWORD!,
  server: process.env.DB_HOST ? process.env.DB_HOST.split(',')[0] : "db",
  port: process.env.DB_HOST && process.env.DB_HOST.includes(',') ? parseInt(process.env.DB_HOST.split(',')[1]) : 1433,
  database: process.env.DB_NAME || "AltDeskDev",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function migrateDefaultPage() {
  console.log("Conectando ao banco para adicionar a coluna DefaultPage na tabela User...");
  let pool;
  try {
    pool = await connect(config);

    const checkColumn = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'User' AND TABLE_SCHEMA = 'altdesk' AND COLUMN_NAME = 'DefaultPage'
    `);

    if (checkColumn.recordset.length === 0) {
      console.log("Coluna DefaultPage não encontrada. Criando...");
      await pool.request().query(`
        ALTER TABLE altdesk.[User]
        ADD DefaultPage NVARCHAR(100) NULL;
      `);
      console.log("Coluna DefaultPage criada com sucesso!");
    } else {
      console.log("Coluna DefaultPage já existe.");
    }

  } catch (err) {
    console.error("Erro na migração de DefaultPage:", err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

migrateDefaultPage();
