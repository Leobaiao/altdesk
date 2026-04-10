import { getPool } from "../db.js";
import { KnowledgeArticle } from "../../../shared/types/index.js";

/**
 * Lists all articles for a tenant.
 */
export async function listArticles(tenantId: string, onlyPublic: boolean = false) {
    const pool = await getPool();
    let query = "SELECT ArticleId, TenantId, Title, Content, Category, IsPublic, CreatedAt, UpdatedAt FROM altdesk.KnowledgeArticle WHERE TenantId = @tenantId AND DeletedAt IS NULL";
    if (onlyPublic) {
        query += " AND IsPublic = 1";
    }
    query += " ORDER BY CreatedAt DESC";

    const r = await pool.request()
        .input("tenantId", tenantId)
        .query(query);
    return r.recordset;
}

/**
 * Creates a new article.
 */
export async function createArticle(tenantId: string, article: Partial<KnowledgeArticle>) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("title", article.Title)
        .input("content", article.Content)
        .input("category", article.Category || null)
        .input("isPublic", article.IsPublic ?? true)
        .query(`
            INSERT INTO altdesk.KnowledgeArticle (TenantId, Title, Content, Category, IsPublic)
            VALUES (@tenantId, @title, @content, @category, @isPublic)
        `);

    const created = await pool.request()
        .input("tenantId", tenantId)
        .input("title", article.Title)
        .query("SELECT TOP 1 * FROM altdesk.KnowledgeArticle WHERE TenantId = @tenantId AND Title = @title ORDER BY CreatedAt DESC");
    return created.recordset[0];
}

/**
 * Updates an article.
 */
export async function updateArticle(tenantId: string, articleId: string, article: Partial<KnowledgeArticle>) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("articleId", articleId)
        .input("title", article.Title)
        .input("content", article.Content)
        .input("category", article.Category || null)
        .input("isPublic", article.IsPublic ?? true)
        .query(`
            UPDATE altdesk.KnowledgeArticle
            SET Title = @title, Content = @content, Category = @category, IsPublic = @isPublic, UpdatedAt = SYSUTCDATETIME()
            WHERE TenantId = @tenantId AND ArticleId = @articleId
        `);
}

/**
 * Deletes an article.
 */
export async function deleteArticle(tenantId: string, articleId: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("articleId", articleId)
        .query("UPDATE altdesk.KnowledgeArticle SET DeletedAt = SYSUTCDATETIME() WHERE TenantId = @tenantId AND ArticleId = @articleId");
}

/**
 * Searches for public articles (for the widget).
 */
export async function searchArticles(tenantId: string, query: string) {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .input("query", `%${query}%`)
        .query(`
            SELECT ArticleId, Title, Content, Category 
            FROM altdesk.KnowledgeArticle 
            WHERE TenantId = @tenantId 
              AND IsPublic = 1 AND DeletedAt IS NULL
              AND (Title LIKE @query OR Content LIKE @query OR Category LIKE @query)
            ORDER BY Title
        `);
    return r.recordset;
}

/**
 * Searches for public articles by ConnectorId.
 */
export async function searchArticlesByConnector(connectorId: string, query: string) {
    const pool = await getPool();
    const r = await pool.request()
        .input("cid", connectorId)
        .input("query", `%${query}%`)
        .query(`
            SELECT a.ArticleId, a.Title, a.Content, a.Category 
            FROM altdesk.KnowledgeArticle a
            JOIN altdesk.Channel ch ON ch.TenantId = a.TenantId
            JOIN altdesk.ChannelConnector cc ON cc.ChannelId = ch.ChannelId
            WHERE cc.ConnectorId = @cid 
              AND a.IsPublic = 1 AND a.DeletedAt IS NULL
              AND (a.Title LIKE @query OR a.Content LIKE @query OR a.Category LIKE @query)
            ORDER BY a.Title
        `);
    return r.recordset;
}
