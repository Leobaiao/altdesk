import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we are running in the dist folder
const isDist = __dirname.includes("dist");
const ext = isDist ? ".js" : ".ts";
const runner = isDist ? "node" : "npx tsx";

// Scripts to run in order
const scripts = [
  "migrate-sla",
  "migrate-metrics",
  "migrate-tags",
  "migrate-knowledge",
  "migrate-business-hours",
  "migrate-csat",
  "migrate-help-articles",
  "migrate-default-page",
  "migrate-audit-log",
  "migrate-exceptions"
];

async function run() {
  console.log(`Starting TS database migrations (Environment: ${isDist ? "Production/Built" : "Development"})...`);
  for (const script of scripts) {
    const scriptPath = path.resolve(__dirname, `${script}${ext}`);
    if (fs.existsSync(scriptPath)) {
      console.log(`Running migration: ${script}`);
      try {
        execSync(`${runner} "${scriptPath}"`, { stdio: "inherit" });
      } catch (err) {
        console.error(`Migration ${script} failed:`, err);
        process.exit(1);
      }
    } else {
      console.warn(`Migration script not found: ${scriptPath}`);
    }
  }
  console.log("All TS migrations executed successfully.");
}

run();
