import "dotenv/config";
import { getPool } from "../db.js";

async function run() {
    const pool = await getPool();
    console.log("Running Knowledge Base Migration...");

    try {
        await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'KnowledgeArticle' AND schema_id = SCHEMA_ID('altdesk'))
      BEGIN
        CREATE TABLE altdesk.KnowledgeArticle (
            ArticleId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
            TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
            Title NVARCHAR(200) NOT NULL,
            Content NVARCHAR(MAX) NOT NULL,
            Category NVARCHAR(50) NULL,
            IsPublic BIT NOT NULL DEFAULT 1,
            CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
            UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        PRINT 'Table altdesk.KnowledgeArticle created.';
      END
      ELSE
      BEGIN
        PRINT 'Table altdesk.KnowledgeArticle already exists.';
      END
    `);
        console.log("Migration finished successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

run();
