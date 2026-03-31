import "dotenv/config";
import { preloadDemoData } from "../services/demoDataService.js";

async function run() {
    try {
        const tenantId = "DE31077B-B630-48DF-98CA-E516A8FF99F5"; // from my last run
        console.log("Running preloadDemoData...");
        await preloadDemoData(tenantId, "demo");
        console.log("Done without uncaught throw!");
    } catch(err) {
        console.error("Crashed:", err);
    }
}
run();
