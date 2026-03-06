
import "dotenv/config";
import { getPool } from "../db.js";

// --- CONFIGURAÇÃO DA NOVA INSTÂNCIA ---
const NEW_INSTANCE = {
    name: "WhatsApp GTI - Suporte", // Nome para identificar no canal
    baseUrl: "https://api.gtiapi.workers.dev",
    instance: "gti-android17", // Ex: i12345
    token: "d7ef03be-cce7-4725-9ce7-79afa277265b"         // Ex: t12345
};
// ---------------------------------------

const TENANT_ID = "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D";

async function run() {
    console.log("=== Adicionando Instância GTI ===");
    const pool = await getPool();

    // 1. Criar Channel se não existir (ou usar um novo para essa instância?)
    // Para simplificar, vamos criar um canal dedicado para essa instância.
    console.log(`Criando canal: ${NEW_INSTANCE.name}...`);
    const channelRes = await pool.request()
        .input("tenantId", TENANT_ID)
        .input("name", NEW_INSTANCE.name)
        .query(`
            DECLARE @cid UNIQUEIDENTIFIER = NEWID();
            INSERT INTO omni.Channel (ChannelId, TenantId, Name, IsActive)
            VALUES (@cid, @tenantId, @name, 1);
            SELECT @cid AS ChannelId;
        `);
    const channelId = channelRes.recordset[0].ChannelId;
    console.log(`✅ Canal criado: ${channelId}`);

    // 2. Criar Conector GTI
    const configJson = JSON.stringify({
        baseUrl: NEW_INSTANCE.baseUrl,
        instance: NEW_INSTANCE.instance,
        token: NEW_INSTANCE.token
    });

    console.log("Adicionando conector GTI...");
    await pool.request()
        .input("channelId", channelId)
        .input("config", configJson)
        .query(`
            INSERT INTO omni.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson, IsActive)
            VALUES (NEWID(), @channelId, 'GTI', @config, 1);
        `);

    console.log("✅ Conector GTI adicionado com sucesso!");
    console.log("Agora o sistema vai usar essa instância para enviar mensagens se ela for selecionada/ativa.");
    process.exit(0);
}

run();
