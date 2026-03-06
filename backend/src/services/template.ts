import { getPool } from "../db.js";

export type Template = {
    TemplateId: string;
    TenantId: string;
    Name: string;
    Content: string;
    Variables: string[]; // parsed JSON
    CreatedAt: string;
};

export async function listTemplates(tenantId: string): Promise<Template[]> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .query(`
      SELECT * FROM omni.Template
      WHERE TenantId = @tenantId
      ORDER BY Name ASC
    `);

    return result.recordset.map((row: any) => ({
        ...row,
        Variables: row.Variables ? JSON.parse(row.Variables) : []
    }));
}

export async function createTemplate(tenantId: string, name: string, content: string, variables: string[]) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("name", name)
        .input("content", content)
        .input("variables", JSON.stringify(variables))
        .query(`
      INSERT INTO omni.Template (TenantId, Name, Content, Variables)
      VALUES (@tenantId, @name, @content, @variables)
    `);
}

export async function deleteTemplate(tenantId: string, templateId: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("templateId", templateId)
        .query(`
      DELETE FROM omni.Template
      WHERE TenantId = @tenantId AND TemplateId = @templateId
    `);
}
