import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/chat";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

/**
 * Sends a prompt to the local Ollama instance and returns the completion.
 * Expects the model to be running locally.
 */
export async function getChatCompletion(messages: { role: "system" | "user" | "assistant", content: string }[]) {
    try {
        const response = await axios.post(OLLAMA_URL, {
            model: OLLAMA_MODEL,
            messages,
            stream: false,
            format: "json"
        });

        return response.data;
    } catch (error: any) {
        console.error("[Ollama] Error:", error.message);
        throw new Error(`Failed to get AI completion: ${error.message}`);
    }
}
