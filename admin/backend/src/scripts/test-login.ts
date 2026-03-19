import "dotenv/config";

async function testLogin() {
    try {
        const res = await fetch("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tenantId: "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D",
                email: "admin@teste.com",
                password: "123456"
            })
        });

        if (!res.ok) {
            const txt = await res.text();
            console.error("Login failed:", res.status, txt);
            process.exit(1);
        }

        const data = await res.json();
        console.log("Login successful! Token:", data.token ? "RECEIVED" : "MISSING");
    } catch (err) {
        console.error("Network error:", err);
        process.exit(1);
    }
}

testLogin();
