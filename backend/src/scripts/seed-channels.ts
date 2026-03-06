
import pkg from "mssql";
const { connect } = pkg;
import "dotenv/config";

const config = {
    user: process.env.DB_USER!,
    password: process.env.DB_PASS!,
    server: process.env.DB_HOST || "db",
    database: process.env.DB_NAME!,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function run() {
    console.log("=== Seeding Channels ===");
    const pool = await connect(config);

    const tenantId = "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D";

    // Check Channel
    let channel = await pool.query(`SELECT TOP 1 ChannelId FROM omni.Channel WHERE TenantId='${tenantId}'`);
    let channelId = "";

    if (channel.recordset.length === 0) {
        console.log("Creating dummy Channel...");
        const res = await pool.query(`
            DECLARE @cid UNIQUEIDENTIFIER = NEWID();
            INSERT INTO omni.Channel (ChannelId, TenantId, Name, IsActive)
            VALUES (@cid, '${tenantId}', 'WhatsApp Principal', 1);
            SELECT @cid AS ChannelId;
        `);
        channelId = res.recordset[0].ChannelId;
    } else {
        channelId = channel.recordset[0].ChannelId;
        console.log("Channel exists:", channelId);
    }

    // Check Connector
    const conn = await pool.query(`SELECT TOP 1 ConnectorId FROM omni.ChannelConnector WHERE ChannelId='${channelId}' AND Provider='WHATSAPP'`);
    if (conn.recordset.length === 0) {
        console.log("Creating dummy Connector...");
        await pool.query(`
            INSERT INTO omni.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson, IsActive)
            VALUES (NEWID(), '${channelId}', 'WHATSAPP', '{}', 1);
        `);
    } else {
        console.log("Connector exists.");
    }

    // Check WebChat Connector
    const wc = await pool.query(`SELECT TOP 1 ConnectorId FROM omni.ChannelConnector WHERE ChannelId='${channelId}' AND Provider='WEBCHAT'`);
    if (wc.recordset.length === 0) {
        console.log("Creating dummy WebChat Connector...");
        await pool.query(`
            INSERT INTO omni.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson, IsActive)
            VALUES (NEWID(), '${channelId}', 'WEBCHAT', '{}', 1);
        `);
    } else {
        console.log("WebChat Connector exists:", wc.recordset[0].ConnectorId);
    }

    console.log("✅ Done seeding.");
    process.exit(0);
}

run();
