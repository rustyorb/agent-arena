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
  // Anti-repetition sampling penalties (0-2). Applied by OpenAI-compatible
  // providers and Ollama; ignored by providers without support (Anthropic).
  frequencyPenalty?: number;
  presencePenalty?: number;
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
