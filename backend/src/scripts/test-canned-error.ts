
const TENANT_ID = "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D";
import "dotenv/config";

async function run() {
    console.log("=== Testing Canned Response Creation ===");

    // 1. Login
    const loginRes = await fetch("http://127.0.0.1:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: TENANT_ID, email: "admin@teste.com", password: "123456" })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
        console.error("Login failed:", loginData);
        process.exit(1);
    }
    const token = loginData.token;

    // 2. Create Response (likely duplicate to trigger error)
    console.log("Creating canned response 'oi'...");
    try {
        const res = await fetch("http://127.0.0.1:3001/api/canned-responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                shortcut: "oi",
                title: "Teste",
                content: "Olá, tudo bem?"
            })
        });

        if (res.ok) {
            console.log("✅ Success");
        } else {
            const txt = await res.text();
            console.error(`❌ Failed (${res.status}):`, txt);
        }
    } catch (e) {
        console.error("❌ Exception during fetch:", e);
    }

    process.exit(0);
}

run();
