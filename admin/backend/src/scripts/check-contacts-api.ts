
import "dotenv/config";
import { listContacts } from "../services/contact.js";

async function run() {
    console.log("=== Listing Contacts ===");
    try {
        const contacts = await listContacts("42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D", "");
        console.log("Is Array?", Array.isArray(contacts));
        console.log("Length:", contacts.length);
        console.log(JSON.stringify(contacts.slice(0, 1), null, 2));
    } catch (e) {
        console.error("Error listing contacts:", e);
    }
    process.exit(0);
}

run();
