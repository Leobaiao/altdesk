
import "dotenv/config";
import { createTemplate, listTemplates, deleteTemplate } from "../services/template.js";

const TENANT_ID = "42D2AD5C-D9D1-4FF9-A285-7DD0CE4CDE5D";

async function run() {
    console.log("=== Testing Template CRUD ===");

    const name = "Test Template " + Date.now();
    const content = "Hello {{name}}, this is a test.";
    const variables = ["name"];

    // 1. Create
    console.log(`Creating template '${name}'...`);
    await createTemplate(TENANT_ID, name, content, variables);

    // 2. List & Verify
    console.log("Listing templates...");
    let templates = await listTemplates(TENANT_ID);
    const created = templates.find(t => t.Name === name);

    if (!created) {
        console.error("❌ Template not found after creation!");
        process.exit(1);
    }
    console.log("✅ Template created and found:", created.TemplateId);

    if (created.Content !== content || JSON.stringify(created.Variables) !== JSON.stringify(variables)) {
        console.error("❌ Content/Variables mismatch!", created);
        process.exit(1);
    }
    console.log("✅ Content and Variables match.");

    // 3. Delete
    console.log("Deleting template...");
    await deleteTemplate(TENANT_ID, created.TemplateId);

    // 4. Verify Deletion
    templates = await listTemplates(TENANT_ID);
    if (templates.find(t => t.TemplateId === created.TemplateId)) {
        console.error("❌ Delete failed! Template still exists.");
        process.exit(1);
    }
    console.log("✅ Template deleted successfully.");

    console.log("=== ALL TESTS PASSED ===");
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
