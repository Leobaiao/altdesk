
import sql from 'mssql';
import { config } from 'dotenv';
config();

// Standard database configuration for AltDesk
const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'AltDesk@2024',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'AltDesk',
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    port: 14333 // Docker mapping
};

async function checkTenants() {
    try {
        console.log('Connecting to:', dbConfig.server, ':', dbConfig.port);
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT COUNT(*) as total FROM altdesk.Tenant');
        console.log('Tenants total:', result.recordset[0].total);
        
        const activeTenants = await pool.request().query('SELECT COUNT(*) as activeCount FROM altdesk.Tenant WHERE DeletedAt IS NULL');
        console.log('Active Tenants:', activeTenants.recordset[0].activeCount);
        
        const deletedTenants = await pool.request().query('SELECT COUNT(*) as deletedCount FROM altdesk.Tenant WHERE DeletedAt IS NOT NULL');
        console.log('Deleted Tenants:', deletedTenants.recordset[0].deletedCount);
        
        const allTenants = await pool.request().query('SELECT Name, DeletedAt, TenantId FROM altdesk.Tenant');
        console.log('Sample Tenants:', allTenants.recordset);
        
        await pool.close();
    } catch (err) {
        console.error('Error during database check:', err);
    }
}

checkTenants();
