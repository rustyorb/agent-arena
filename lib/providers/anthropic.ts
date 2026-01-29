import { AIProvider, Model, ChatConfig } from "./types";

const ANTHROPIC_MODELS = [
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
  { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
  { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
  { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
];

export const anthropic: AIProvider = {
  name: "Anthropic",
  id: "anthropic",
  baseUrl: "https://api.anthropic.com/v1",
  requiresKey: true,

  async validateKey(key: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      return res.ok || res.status === 400; // 400 means key is valid but request is bad
    } catch {
      return false;
    }
  },

  async fetchModels(): Promise<Model[]> {
    return ANTHROPIC_MODELS.map((m) => ({
      ...m,
      provider: "anthropic",
    }));
  },

  async *chat(config: ChatConfig, apiKey?: string): AsyncGenerator<string> {
    if (!apiKey) throw new Error("API key required");

    // Convert messages - Anthropic needs system separate
    const systemMsg = config.messages.find((m) => m.role === "system");
    const otherMsgs = config.messages.filter((m) => m.role !== "system");

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens ?? 1024,
        ...(systemMsg && { system: systemMsg.content }),
        messages: otherMsgs.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        stream: true,
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const json = JSON.parse(data);
            if (json.type === "content_block_delta") {
              const text = json.delta?.text;
              if (text) yield text;
            }
          } catch {}
        }
      }
    }
  },
};
