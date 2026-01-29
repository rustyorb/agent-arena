import { AIProvider, ProviderId } from "./types";
import { openrouter } from "./openrouter";
import { anthropic } from "./anthropic";
import { openai } from "./openai";
import { xai } from "./xai";
import { lmstudio } from "./lmstudio";
import { ollama } from "./ollama";

export const providers: Record<ProviderId, AIProvider> = {
  openrouter,
  anthropic,
  openai,
  xai,
  lmstudio,
  ollama,
};

export function getProvider(id: ProviderId): AIProvider {
  return providers[id];
}

export * from "./types";
