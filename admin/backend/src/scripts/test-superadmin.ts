import "dotenv/config";

async function testSuperAdmin() {
    try {
        const res = await fetch("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "superadmin@teste.com",
                password: "123456"
            })
        });

        if (!res.ok) {
            const txt = await res.text();
            console.error("Login failed:", res.status, txt);
            process.exit(1);
        }

        const data = await res.json();
        console.log("SuperAdmin Login successful! Token:", data.token ? "RECEIVED" : "MISSING");
        console.log("Role:", data.role);
    } catch (err) {
        console.error("Network error:", err);
        process.exit(1);
    }
}

testSuperAdmin();
