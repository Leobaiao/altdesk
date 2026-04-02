import "dotenv/config";
import axios from "axios";

async function run() {
    try {
        console.log("Testing onboarding flow (demo mode)...");
        
        const testEmail = `admin_demo_${Date.now()}@example.com`;
        const companyEmail = `company_demo_${Date.now()}@example.com`;
        
        const payload = {
            companyName: "Demo Corp",
            email: companyEmail,
            adminName: "Admin Test",
            adminEmail: testEmail,
            password: process.env.TEST_PASSWORD || "Password@123",
            preloadModel: "demo"
        };
        
        console.log("Calling POST /api/onboarding with payload:", payload);
        const res = await axios.post("http://localhost:3002/api/onboarding", payload);
        
        console.log("Onboarding Response:", res.data);
        const { tenantId, token } = res.data;
        
        if (!tenantId) {
            throw new Error("No tenantId returned");
        }
        
        console.log(`\n--- Verifying Data for Tenant: ${tenantId} ---`);
        
        const api = axios.create({
            baseURL: "http://localhost:3002/api",
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const articlesObj = await api.get("/knowledge").catch(e => ({ data: [] }));
        const articles = Array.isArray(articlesObj.data) ? articlesObj.data : (articlesObj.data.articles || []);
        console.log(`Knowledge Articles created: ${articles.length}`);
        articles.forEach((a: any) => console.log(` - [${a.Category}] ${a.Title}`));
        
        const contactsObj = await api.get("/contacts").catch(e => ({ data: [] }));
        const contacts = Array.isArray(contactsObj.data) ? contactsObj.data : (contactsObj.data.contacts || []);
        console.log(`\nContacts created: ${contacts.length}`);
        contacts.forEach((c: any) => console.log(` - ${c.Name} (Tags: ${c.Tags ? c.Tags.join(', ') : 'none'})`));
        
        const conversationsObj = await api.get("/conversations").catch(e => { console.error("Conversations Error:", e.response?.data || e.message); return { data: [] }; });
        const conversations = Array.isArray(conversationsObj.data) ? conversationsObj.data : (conversationsObj.data.conversations || []);
        console.log(`\nConversations created: ${conversations.length}`);
        conversations.forEach((c: any) => console.log(` - ${c.Title} [${c.Status}]`));
        
        const ticketsObj = await api.get("/tickets").catch(e => { console.error("Tickets Error:", e.response?.data || e.message); return { data: [] }; });
        const tickets = Array.isArray(ticketsObj.data) ? ticketsObj.data : (ticketsObj.data.tickets || []);
        console.log(`\nTickets created: ${tickets.length}`);
        tickets.forEach((t: any) => console.log(` - ${t.TicketId} [${t.Status}] - Prioridade: ${t.Priority}`));

        console.log("\n✅ Test completed successfully!");
        process.exit(0);
        
    } catch (err: any) {
        console.error("Test failed:", err.response?.data || err.message);
        process.exit(1);
    }
}

run();
