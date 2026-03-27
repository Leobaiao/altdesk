import sql from "mssql";

const config = {
  user: "sa",
  password: "Intamr17@",
  server: "localhost",
  port: 14333,
  database: "master",
  options: { encrypt: false, trustServerCertificate: true }
};

async function check() {
  try {
    let pool = await sql.connect(config);
    let dbs = await pool.request().query("SELECT name FROM sys.databases WHERE database_id > 4");
    console.log("Databases:", dbs.recordset.map(r => r.name));
    
    for (let db of dbs.recordset) {
      console.log(`--- Checking DB: ${db.name} ---`);
      try {
        await pool.request().query(`USE [${db.name}]`);
        let tenants = await pool.request().query("SELECT COUNT(*) as count FROM altdesk.Tenant");
        console.log(`Tenants in ${db.name}:`, tenants.recordset[0].count);
        let users = await pool.request().query("SELECT COUNT(*) as count FROM altdesk.[User]");
        console.log(`Users in ${db.name}:`, users.recordset[0].count);
      } catch (e) {
        console.log(`Could not check tables in ${db.name}: ${e.message}`);
      }
    }
    await sql.close();
  } catch (err) {
    console.error("Error:", err.message);
  }
}
check();
