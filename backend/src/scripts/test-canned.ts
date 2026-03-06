import "dotenv/config";

const API = "http://localhost:3001/api";
const EMAIL = "admin@teste.com";
const PASS = "123456";
const TENANT = "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D";

async function test() {
    // 1. Login
    const loginRes = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASS, tenantId: TENANT })
    });
    if (!loginRes.ok) throw new Error("Login failed");
    const { token } = await loginRes.json();
    console.log("Login OK");

    // 2. Create
    const createRes = await fetch(`${API}/canned-responses`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ shortcut: "test", content: "This is a test", title: "Test Title" })
    });
    if (!createRes.ok) {
        const txt = await createRes.text();
        throw new Error(`Create failed: ${txt}`);
    }
    console.log("Create OK");

    // 3. List
    const listRes = await fetch(`${API}/canned-responses`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const items = await listRes.json();
    console.log("List OK. Items:", items.length);
    const created = items.find((i: any) => i.Shortcut === "test");
    if (!created) throw new Error("Created item not found");

    // 4. Delete
    const delRes = await fetch(`${API}/canned-responses/${created.CannedResponseId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (!delRes.ok) throw new Error("Delete failed");
    console.log("Delete OK");
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
