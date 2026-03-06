import { getPool } from "../db.js";

export interface BusinessHour {
    DayOfWeek: number;
    StartTime: string;
    EndTime: string;
    IsActive: boolean;
}

/**
 * Get business hours for a tenant.
 */
export async function getBusinessHours(tenantId: string): Promise<BusinessHour[]> {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT DayOfWeek, CONVERT(VARCHAR(5), StartTime, 108) as StartTime, CONVERT(VARCHAR(5), EndTime, 108) as EndTime, IsActive FROM altdesk.BusinessHours WHERE TenantId = @tenantId ORDER BY DayOfWeek");
    return r.recordset;
}

/**
 * Save business hours for a tenant (upsert all days).
 */
export async function setBusinessHours(tenantId: string, hours: BusinessHour[]) {
    const pool = await getPool();
    for (const h of hours) {
        await pool.request()
            .input("tenantId", tenantId)
            .input("day", h.DayOfWeek)
            .input("start", h.StartTime)
            .input("end", h.EndTime)
            .input("active", h.IsActive)
            .query(`
                MERGE altdesk.BusinessHours AS target
                USING (VALUES (@tenantId, @day, @start, @end, @active)) AS source (TenantId, DayOfWeek, StartTime, EndTime, IsActive)
                ON target.TenantId = source.TenantId AND target.DayOfWeek = source.DayOfWeek
                WHEN MATCHED THEN
                    UPDATE SET StartTime = source.StartTime, EndTime = source.EndTime, IsActive = source.IsActive
                WHEN NOT MATCHED THEN
                    INSERT (TenantId, DayOfWeek, StartTime, EndTime, IsActive)
                    VALUES (source.TenantId, source.DayOfWeek, source.StartTime, source.EndTime, source.IsActive);
            `);
    }
}

/**
 * Check if the current UTC time is within business hours for the tenant.
 */
export async function isWithinBusinessHours(tenantId: string): Promise<boolean> {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT COUNT(*) as cnt
            FROM altdesk.BusinessHours
            WHERE TenantId = @tenantId
              AND IsActive = 1
              AND DayOfWeek = DATEPART(WEEKDAY, GETDATE()) - 1
              AND CAST(GETDATE() AS TIME) BETWEEN StartTime AND EndTime
        `);

    // If no business hours configured, consider always open
    const totalConfig = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT COUNT(*) as cnt FROM altdesk.BusinessHours WHERE TenantId = @tenantId");

    if (totalConfig.recordset[0].cnt === 0) return true; // No config = always open

    return r.recordset[0].cnt > 0;
}

/**
 * Get the off-hours auto-reply message for the tenant.
 */
export async function getOffHoursMessage(tenantId: string): Promise<string | null> {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT OffHoursMessage FROM altdesk.Tenant WHERE TenantId = @tenantId");
    return r.recordset[0]?.OffHoursMessage || null;
}

/**
 * Set the off-hours auto-reply message.
 */
export async function setOffHoursMessage(tenantId: string, message: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("msg", message)
        .query("UPDATE altdesk.Tenant SET OffHoursMessage = @msg WHERE TenantId = @tenantId");
}
