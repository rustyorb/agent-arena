export interface Model {
  id: string;
  name: string;
  provider: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatConfig {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIProvider {
  name: string;
  id: string;
  baseUrl: string;
  requiresKey: boolean;
  
  validateKey(key: string): Promise<boolean>;
  fetchModels(key?: string): Promise<Model[]>;
  chat(config: ChatConfig, apiKey?: string): AsyncGenerator<string, void, unknown>;
}

export const PROVIDERS = [
  "openrouter",
  "anthropic",
  "openai",
  "xai",
  "openclaw",
  "lmstudio",
  "ollama"
] as const;

export type ProviderId = typeof PROVIDERS[number];
