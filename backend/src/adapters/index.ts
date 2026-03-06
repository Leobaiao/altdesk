import { GtiAdapter } from "./gti.js";
import { OfficialAdapter } from "./official.js";
import { WebChatAdapter } from "./webchat.js";
import { ChannelAdapter } from "./types.js";

const adapters: Record<string, ChannelAdapter> = {
    gti: new GtiAdapter(),
    official: new OfficialAdapter(),
    webchat: new WebChatAdapter()
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
