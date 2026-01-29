import { AIProvider, Model, ChatConfig } from "./types";

export const lmstudio: AIProvider = {
  name: "LM Studio",
  id: "lmstudio",
  baseUrl: "http://localhost:6969/v1",
  requiresKey: false,

  async validateKey(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`);
      return res.ok;
    } catch {
      return false;
    }
  },

  async fetchModels(): Promise<Model[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        provider: "lmstudio",
      }));
    } catch {
      return [];
    }
  },

  async *chat(config: ChatConfig): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1024,
        stream: true,
      }),
    });

    if (!res.ok) throw new Error(`LM Studio error: ${res.status}`);
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
