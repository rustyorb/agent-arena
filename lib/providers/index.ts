import { AIProvider, ProviderId } from "./types";
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
export function resolveProvider(id: ProviderId, baseUrl?: string): AIProvider | undefined {
  const provider = providers[id];
  if (!provider) return undefined;
  if (baseUrl && baseUrl.trim()) {
    return { ...provider, baseUrl: baseUrl.trim().replace(/\/+$/, "") };
  }
  return provider;
}

export * from "./types";
