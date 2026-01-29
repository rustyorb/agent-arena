import { AIProvider, Model, ChatConfig } from "./types";

export const xai: AIProvider = {
  name: "X.AI (Grok)",
  id: "xai",
  baseUrl: "https://api.x.ai/v1",
  requiresKey: true,

  async validateKey(key: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async fetchModels(key?: string): Promise<Model[]> {
    if (!key) return [];
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        provider: "xai",
      }));
    } catch {
      return [];
    }
  },

  async *chat(config: ChatConfig, apiKey?: string): AsyncGenerator<string> {
    if (!apiKey) throw new Error("API key required");

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1024,
        stream: true,
      }),
    });

    if (!res.ok) throw new Error(`X.AI error: ${res.status}`);
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
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {}
        }
      }
    }
  },
};
