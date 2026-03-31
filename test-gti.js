// test-gti.js
// Rode este arquivo no terminal usando: node test-gti.js

// ==== CONFIGURAÇÕES ====
const API_URL = "https://api.gtiapi.workers.dev";
const API_TOKEN = "d7ef03be-cce7-4725-9ce7-79afa277265b"; // ⚠ Seu Token
// =======================

async function testGTI() {
    console.log("=========================================");
    console.log(`🧪 Testando comunicação com a API da GTI (Apenas Token)`);
    console.log(`URL Base: ${API_URL}`);
    console.log("=========================================\n");
    
    // ---------------------------------------------------------
    // TESTE: Verificar status da instância via endpoint genérico
    // ---------------------------------------------------------
    try {
        console.log(`➡️ [Teste] Buscando informações da instância via Token`);
        
        // Se a API não usa nome na URL, geralmente ela identifica pelo Token no Header
        // Vamos testar o endpoint de status base
        const res = await fetch(`${API_URL}/instance/status`, {
            method: "GET",
            headers: {
                "token": API_TOKEN,
                "apikey": API_TOKEN,
                "Content-Type": "application/json"
            }
        });
        
        const data = await res.json();
        console.log(`HTTP Status: ${res.status} ${res.ok ? "✅" : "❌"}`);
        console.log("Resposta:", JSON.stringify(data, null, 2));
        
    } catch (err) {
        console.error("❌ Falha na requisição:", err.message);
    }

    console.log("\n---------------------------------------------------------\n");

    // ---------------------------------------------------------
    // TESTE 2: Tentar conexão (Connect) apenas com Token
    // ---------------------------------------------------------
    try {
        console.log(`➡️ [Teste 2] Tentando endpoint /instance/connect`);
        const res = await fetch(`${API_URL}/instance/connect`, {
            method: "POST",
            headers: {
                "token": API_TOKEN,
                "apikey": API_TOKEN,
                "Content-Type": "application/json"
            },
            body: "{}"
        });
        
        const data = await res.json();
        console.log(`HTTP Status: ${res.status} ${res.ok ? "✅" : "❌"}`);
        console.log("Resposta:", JSON.stringify(data, null, 2));
        
    } catch (err) {
        console.error("❌ Falha na requisição (Teste 2):", err.message);
    }
    
    console.log("\n=========================================");
    console.log("🔚 Teste finalizado.");
}

testGTI();
