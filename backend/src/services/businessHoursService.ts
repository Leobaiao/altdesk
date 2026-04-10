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
 * Check if the current local time is within business hours for the tenant.
 */
export async function isWithinBusinessHours(tenantId: string): Promise<boolean> {
    const pool = await getPool();

    // 1. Check for date-specific EXCEPTIONS first (e.g. Holidays)
    const excR = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT IsOpen, StartTime, EndTime 
            FROM altdesk.BusinessDayException 
            WHERE TenantId = @tenantId 
              AND Date = CAST(GETDATE() AS DATE)
        `);

    if (excR.recordset.length > 0) {
        const exc = excR.recordset[0];
        if (!exc.IsOpen) return false; // Closed today!

        // If it's open but has specific hours
        if (exc.StartTime && exc.EndTime) {
            const now = new Date();
            const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
            
            const start = exc.StartTime.toISOString().split('T')[1].substring(0, 5);
            const end = exc.EndTime.toISOString().split('T')[1].substring(0, 5);

            return timeStr >= start && timeStr <= end;
        }
        
        return true; // Open all day (no specific hours set in exception)
    }

    // 2. Fallback to weekly schedule
    const r = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT COUNT(*) as cnt
            FROM altdesk.BusinessHours
            WHERE TenantId = @tenantId
              AND IsActive = 1
              AND DayOfWeek = (DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2) % 7
              AND CAST(GETDATE() AS TIME) BETWEEN StartTime AND EndTime
        `);

    // Note: DATEPART(WEEKDAY) depends on DATEFIRST settings. 
    // Usually, 1=Sunday, 7=Saturday. We want 0=Sunday, 6=Saturay.
    // However, my previous code used: DayOfWeek = DATEPART(WEEKDAY, GETDATE()) - 1
    // Let's stick to the previous one if it worked, but exceptions are better handled now.

    const totalConfig = await pool.request()
        .input("tenantId", tenantId)
        .query("SELECT COUNT(*) as cnt FROM altdesk.BusinessHours WHERE TenantId = @tenantId");

    if (totalConfig.recordset[0].cnt === 0) return true; // No config = always open

    return r.recordset[0].cnt > 0;
}

/**
 * List exceptions for a tenant
 */
export async function getBusinessExceptions(tenantId: string) {
    const pool = await getPool();
    const r = await pool.request()
        .input("tenantId", tenantId)
        .query(`
            SELECT ExceptionId, [Date], Description, IsOpen, 
                   CONVERT(VARCHAR(5), StartTime, 108) as StartTime, 
                   CONVERT(VARCHAR(5), EndTime, 108) as EndTime
            FROM altdesk.BusinessDayException
            WHERE TenantId = @tenantId
            ORDER BY [Date] ASC
        `);
    return r.recordset;
}

/**
 * Add a business exception
 */
export async function addBusinessException(tenantId: string, data: any) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("date", data.date)
        .input("desc", data.description)
        .input("isOpen", data.isOpen ? 1 : 0)
        .input("start", data.startTime || null)
        .input("end", data.endTime || null)
        .query(`
            INSERT INTO altdesk.BusinessDayException (TenantId, [Date], Description, IsOpen, StartTime, EndTime)
            VALUES (@tenantId, @date, @desc, @isOpen, @start, @end)
        `);
}

/**
 * Delete a business exception
 */
export async function deleteBusinessException(tenantId: string, id: string) {
    const pool = await getPool();
    await pool.request()
        .input("tenantId", tenantId)
        .input("id", id)
        .query("DELETE FROM altdesk.BusinessDayException WHERE TenantId = @tenantId AND ExceptionId = @id");
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
