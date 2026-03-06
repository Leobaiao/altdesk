import { getPool } from "../db.js";

export type Contact = {
    ContactId: string;
    TenantId: string;
    Name: string;
    Phone: string;
    Email: string | null;
    Tags: string[] | null;
    Notes: string | null;
    CreatedAt: string;
};

export async function listContacts(tenantId: string, search?: string): Promise<Contact[]> {
    const pool = await getPool();
    let query = `
    SELECT * FROM omni.Contact
    WHERE TenantId = @tenantId
  `;

    if (search) {
        query += ` AND (Name LIKE @search OR Phone LIKE @search OR Email LIKE @search)`;
    }

    query += ` ORDER BY Name ASC`;

    const request = pool.request().input("tenantId", tenantId);
    if (search) request.input("search", `%${search}%`);

    const result = await request.query(query);

    return result.recordset.map((row: any) => ({
        ...row,
        Tags: row.Tags ? JSON.parse(row.Tags) : []
    }));
}

export async function createContact(tenantId: string, data: { name: string, phone: string, email?: string, tags?: string[], notes?: string }) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("name", data.name)
        .input("phone", data.phone)
        .input("email", data.email ?? null)
        .input("tags", data.tags ? JSON.stringify(data.tags) : null)
        .input("notes", data.notes ?? null)
        .query(`
      INSERT INTO omni.Contact (TenantId, Name, Phone, Email, Tags, Notes)
      VALUES (@tenantId, @name, @phone, @email, @tags, @notes)
    `);
}

export async function updateContact(tenantId: string, contactId: string, data: { name?: string, phone?: string, email?: string | null, tags?: string[] | null, notes?: string | null }) {
    const pool = await getPool();
    // Simplified update: assumes all fields provided or null
    // ideally we build dynamic query but for MVP let's assume UI sends full object or we partial update key fields
    // Let's do a dynamic update construction or just update everything if provided

    const sets: string[] = [];
    const request = pool.request()
        .input("tenantId", tenantId)
        .input("contactId", contactId);

    if (data.name !== undefined) { sets.push("Name = @name"); request.input("name", data.name); }
    if (data.phone !== undefined) { sets.push("Phone = @phone"); request.input("phone", data.phone); }
    if (data.email !== undefined) { sets.push("Email = @email"); request.input("email", data.email); }
    if (data.tags !== undefined) { sets.push("Tags = @tags"); request.input("tags", JSON.stringify(data.tags)); }
    if (data.notes !== undefined) { sets.push("Notes = @notes"); request.input("notes", data.notes); }

    if (sets.length === 0) return;

    await request.query(`
    UPDATE omni.Contact
    SET ${sets.join(", ")}
    WHERE TenantId = @tenantId AND ContactId = @contactId
  `);
}

export async function deleteContact(tenantId: string, contactId: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("contactId", contactId)
        .query(`DELETE FROM omni.Contact WHERE TenantId = @tenantId AND ContactId = @contactId`);
}

export async function getContactByPhone(tenantId: string, phone: string): Promise<Contact | null> {
    const pool = await getPool();
    const result = await pool.request()
        .input("tenantId", tenantId)
        .input("phone", phone)
        .query(`SELECT TOP 1 * FROM omni.Contact WHERE TenantId = @tenantId AND Phone = @phone`);

    if (result.recordset.length === 0) return null;
    const row = result.recordset[0];
    return { ...row, Tags: row.Tags ? JSON.parse(row.Tags) : [] };
}
