const sql = require('mssql');
const { getPool } = require('./backend/src/db.js');

async function listTenantReferences() {
    try {
        const pool = await getPool();
        const res = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME = 'TenantId' AND TABLE_SCHEMA = 'altdesk'");
        console.log(res.recordset.map(r => r.TABLE_NAME).join(', '));
    } catch (err) {
        console.error(err);
    }
}
listTenantReferences();
