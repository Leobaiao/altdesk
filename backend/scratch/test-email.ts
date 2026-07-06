import "dotenv/config";
import { sendPasswordResetEmail } from "../src/services/emailService.js";

async function run() {
    try {
        console.log("Testing email sending...");
        await sendPasswordResetEmail("leobaiao966@gmail.com", "http://localhost:3000/reset-password?token=testtoken");
        console.log("Email sent successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Email sending failed:", err);
        process.exit(1);
    }
}

run();
