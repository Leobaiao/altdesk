import "dotenv/config";
import { getPool } from "../db.js";

async function run() {
    const pool = await getPool();
    console.log("Running Tags Migration...");

    try {
        await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tag' AND schema_id = SCHEMA_ID('altdesk'))
      BEGIN
        CREATE TABLE altdesk.Tag (
            TagId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
            TenantId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
            Name NVARCHAR(50) NOT NULL,
            Color NVARCHAR(20) NOT NULL DEFAULT '#E2E8F0',
            CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UK_Tag_Name UNIQUE (TenantId, Name)
        );
        PRINT 'Table altdesk.Tag created.';
      END

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ConversationTag' AND schema_id = SCHEMA_ID('altdesk'))
      BEGIN
        CREATE TABLE altdesk.ConversationTag (
            ConversationId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Conversation(ConversationId),
            TagId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tag(TagId),
            PRIMARY KEY (ConversationId, TagId)
        );
        PRINT 'Table altdesk.ConversationTag created.';
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
