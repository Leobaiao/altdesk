import { getPool } from "../db.js";
import { HelpArticle } from "../../../shared/types/index.js";

/**
 * Resolves the contextual help article for a given contextKey and tenantId.
 * Prioritizes tenant-specific custom articles over global ones.
 */
export async function getHelpArticle(contextKey: string, tenantId?: string | null): Promise<HelpArticle | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("contextKey", contextKey)
        .input("tenantId", tenantId || null)
        .query(`
            SELECT TOP 1 HelpArticleId, TenantId, ContextKey, Title, Content, Category, PagePath, IsActive, CreatedAt, UpdatedAt
            FROM altdesk.HelpArticle
            WHERE ContextKey = @contextKey 
              AND IsActive = 1 
              AND DeletedAt IS NULL
              AND (TenantId = @tenantId OR TenantId IS NULL)
            ORDER BY TenantId DESC
        `);

    return result.recordset[0] || null;
}

/**
 * Lists help articles.
 * - If tenantId is specified, returns articles belonging to that tenant AND global articles (read-only reference).
 * - If no tenantId is specified, returns all articles (usually for SuperAdmin).
 */
export async function listHelpArticles(tenantId?: string | null): Promise<HelpArticle[]> {
    const pool = await getPool();
    const request = pool.request();
    
    let query = `
        SELECT HelpArticleId, TenantId, ContextKey, Title, Content, Category, PagePath, IsActive, CreatedAt, UpdatedAt
        FROM altdesk.HelpArticle
        WHERE DeletedAt IS NULL
    `;

    if (tenantId) {
        request.input("tenantId", tenantId);
        query += " AND (TenantId = @tenantId OR TenantId IS NULL)";
    }

    query += " ORDER BY ContextKey ASC, TenantId DESC";
    const result = await request.query(query);
    return result.recordset;
}

/**
 * Saves or updates a help article.
 * Uses SQL Server MERGE to handle upsert safely by (TenantId, ContextKey) combination.
 */
export async function upsertHelpArticle(article: Partial<HelpArticle> & { ContextKey: string; Title: string; Content: string }): Promise<HelpArticle> {
    const pool = await getPool();
    const tenantId = article.TenantId || null;
    
    // T-SQL merge that handles NULL TenantId safely
    const query = `
        MERGE altdesk.HelpArticle AS target
        USING (SELECT @tenantId AS TenantId, @contextKey AS ContextKey) AS source
        ON (
            (target.TenantId = source.TenantId OR (target.TenantId IS NULL AND source.TenantId IS NULL))
            AND target.ContextKey = source.ContextKey
            AND target.DeletedAt IS NULL
        )
        WHEN MATCHED THEN
            UPDATE SET 
                Title = @title, 
                Content = @content, 
                Category = @category, 
                PagePath = @pagePath, 
                IsActive = @isActive,
                UpdatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (TenantId, ContextKey, Title, Content, Category, PagePath, IsActive)
            VALUES (@tenantId, @contextKey, @title, @content, @category, @pagePath, @isActive)
        OUTPUT inserted.*;
    `;

    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("contextKey", article.ContextKey)
        .input("title", article.Title)
        .input("content", article.Content)
        .input("category", article.Category || null)
        .input("pagePath", article.PagePath || null)
        .input("isActive", article.IsActive ?? true)
        .query(query);

    return result.recordset[0];
}

/**
 * Soft-deletes a help article.
 * If tenantId is specified, restricts deletion to the tenant's own articles.
 */
export async function deleteHelpArticle(articleId: string, tenantId?: string | null): Promise<boolean> {
    const pool = await getPool();
    const request = pool.request()
        .input("articleId", articleId);
    
    let query = `
        UPDATE altdesk.HelpArticle 
        SET DeletedAt = SYSUTCDATETIME() 
        WHERE HelpArticleId = @articleId AND DeletedAt IS NULL
    `;

    if (tenantId) {
        request.input("tenantId", tenantId);
        query += " AND TenantId = @tenantId";
    }

    const result = await request.query(query);
    return (result.rowsAffected[0] || 0) > 0;
}
