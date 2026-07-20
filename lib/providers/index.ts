import { AIProvider, ProviderId } from "./types";
import { createOpenAICompatProvider } from "./custom";
import { openrouter } from "./openrouter";
import { anthropic } from "./anthropic";
import { openai } from "./openai";
import { xai } from "./xai";
import { openclaw } from "./openclaw";
import { lmstudio } from "./lmstudio";
import { ollama } from "./ollama";

export const providers: Record<ProviderId, AIProvider> = {
  openrouter,
  anthropic,
  openai,
  xai,
  openclaw,
  lmstudio,
  ollama,
};

export function getProvider(id: ProviderId): AIProvider {
  return providers[id];
}

// Returns the provider with an optional per-request base URL override
// (users can point providers at custom hosts from /settings).
// All provider methods read `this.baseUrl`, so a shallow copy is enough.
// Unknown ids WITH a URL become user-defined OpenAI-compatible providers.
export function resolveProvider(id: string, baseUrl?: string): AIProvider | undefined {
  const provider = providers[id as ProviderId];
  const url = baseUrl?.trim().replace(/\/+$/, "");
  if (provider) {
    return url ? { ...provider, baseUrl: url } : provider;
  }
  if (url) {
    return createOpenAICompatProvider(id, url);
  }
  return undefined;
}

export * from "./types";
