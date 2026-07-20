import { AIProvider, Model, ChatConfig } from "./types";

// Factory for user-defined OpenAI-compatible providers added on /settings
// (vLLM, LocalAI, text-gen-webui, llama.cpp server, LiteLLM proxies, ...).
// Speaks GET /models + POST /chat/completions with optional Bearer auth.
export function createOpenAICompatProvider(id: string, baseUrl: string): AIProvider {
  const root = baseUrl.replace(/\/+$/, "");
  const authHeaders = (key?: string): Record<string, string> =>
    key ? { Authorization: `Bearer ${key}` } : {};

  return {
    name: id,
    id,
    baseUrl: root,
    requiresKey: false,

    async validateKey(key: string): Promise<boolean> {
      try {
        const res = await fetch(`${root}/models`, { headers: authHeaders(key) });
        return res.ok;
      } catch {
        return false;
      }
    },

    async fetchModels(key?: string): Promise<Model[]> {
      try {
        const res = await fetch(`${root}/models`, { headers: authHeaders(key) });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.id,
          provider: id,
        }));
      } catch {
        return [];
      }
    },

    async *chat(config: ChatConfig, apiKey?: string): AsyncGenerator<string> {
      const res = await fetch(`${root}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(apiKey) },
        body: JSON.stringify({
          model: config.model,
          messages: config.messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens ?? 1024,
          stream: true,
        }),
      });

      if (!res.ok) throw new Error(`${id} error: ${res.status}`);
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
}
