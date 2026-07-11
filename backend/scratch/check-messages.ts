import "dotenv/config";
import { getPool } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

async function run() {
    try {
        const { activateOfficialSubscription } = await import("../src/services/subscriptionService.js");
        const tenantId = "7E9DAE72-E6E2-4F6B-A970-453BF7E17CC4";
        console.log(`Activating subscription for tenant: ${tenantId}...`);
        const res = await activateOfficialSubscription(tenantId);
        console.log("Result:", res);
        process.exit(0);
    } catch (err) {
        console.error("Operation failed:", err);
        process.exit(1);
    }
}

run();
