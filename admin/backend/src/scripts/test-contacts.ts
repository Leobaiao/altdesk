
import "dotenv/config";
import { getPool } from "../db.js";
import { createContact, listContacts, updateContact, deleteContact } from "../services/contact.js";

async function run() {
    const tenantId = "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D";
    const phone = "5511999999999" + Math.floor(Math.random() * 1000);

    console.log("=== Testing Contact API ===");

    // 1. Create
    console.log(`Creating contact with phone ${phone}...`);
    await createContact(tenantId, {
        name: "Test User",
        phone,
        email: "test@script.com",
        tags: ["script-tag"],
        notes: "Initial note"
    });

    // 2. List & Verify
    console.log("Listing contacts...");
    let contacts = await listContacts(tenantId, phone);
    let contact = contacts.find(c => c.Phone === phone);

    if (!contact) {
        console.error("❌ Contact not found after creation!");
        process.exit(1);
    }
    console.log("✅ Contact created and found:", contact.ContactId);

    // 3. Update
    console.log("Updating contact note to 'VIP Customer'...");
    await updateContact(tenantId, contact.ContactId, {
        notes: "VIP Customer"
    });

    // 4. Verify Update
    contacts = await listContacts(tenantId, phone);
    contact = contacts.find(c => c.ContactId === contact!.ContactId);

    if (contact?.Notes !== "VIP Customer") {
        console.error("❌ Update failed! Note is:", contact?.Notes);
        process.exit(1);
    }
    console.log("✅ Contact updated successfully. Note persisted: " + contact.Notes);

    // 5. Delete
    console.log("Deleting contact...");
    await deleteContact(tenantId, contact.ContactId);

    contacts = await listContacts(tenantId, phone);
    if (contacts.find(c => c.ContactId === contact.ContactId)) {
        console.error("❌ Delete failed! Contact still exists.");
        process.exit(1);
    }
    console.log("✅ Contact deleted successfully.");

    console.log("=== ALL TESTS PASSED ===");
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
