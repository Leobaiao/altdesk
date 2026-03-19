
const TENANT_ID = "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D";
// We need a token. I'll login first then post.
import "dotenv/config";

async function run() {
    console.log("=== Testing API Zod Validation ===");

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

    // 2. Post Contact with empty email
    console.log("Sending contact with email: '' ...");
    const res = await fetch("http://127.0.0.1:3001/api/contacts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
            name: "Zod Test",
            phone: "5511888888888",
            email: "", // Empty string
            notes: "Testing zod"
        })
    });

    if (res.ok) {
        console.log("✅ Success (200 OK)");
    } else {
        const err = await res.text();
        console.error(`❌ Failed (${res.status}):`, err);
    }

    process.exit(0);
}

run();
