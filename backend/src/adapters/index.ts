import { GtiAdapter } from "./gti.js";
import { OfficialAdapter } from "./official.js";
import { WebChatAdapter } from "./webchat.js";
import { EmailAdapter } from "./email.js";
import { ChannelAdapter } from "./types.js";

export const adapters: Record<string, ChannelAdapter> = {
    gti: new GtiAdapter(),
    official: new OfficialAdapter(),
    webchat: new WebChatAdapter(),
    smtp: new EmailAdapter(),
    email: new EmailAdapter() // Alias
};

/**
 * Resolves the appropriate adapter for a given provider name.
 */
export function resolveAdapter(provider: string): ChannelAdapter {
    const key = provider.toLowerCase();
    const adapter = adapters[key];
    if (!adapter) {
        throw new Error(`Adapter for provider '${provider}' not found.`);
    }
    return adapter;
}
