
import "dotenv/config";
import sql from "mssql";
import { getPool } from "../db.js";

async function checkTenants() {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT COUNT(*) as total FROM altdesk.Tenant');
        console.log('Tenants total:', result.recordset[0].total);
        
        const activeTenants = await pool.request().query('SELECT COUNT(*) as activeCount FROM altdesk.Tenant WHERE DeletedAt IS NULL');
        console.log('Active Tenants:', activeTenants.recordset[0].activeCount);
        
        const deletedTenants = await pool.request().query('SELECT COUNT(*) as deletedCount FROM altdesk.Tenant WHERE DeletedAt IS NOT NULL');
        console.log('Deleted Tenants:', deletedTenants.recordset[0].deletedCount);
        
        const allTenants = await pool.request().query('SELECT Name, DeletedAt, TenantId FROM altdesk.Tenant');
        console.log('All Tenants Sample:', JSON.stringify(allTenants.recordset, null, 2));
        
    } catch (err) {
        console.error('Error during database check:', err);
    }
}

checkTenants();
