import { AIProvider, Model, ChatConfig } from "./types";

const OPENCLAW_MODELS = [
  { id: "openclaw:main", name: "OpenClaw (main)" },
];

export const openclaw: AIProvider = {
  name: "OpenClaw",
  id: "openclaw",
  baseUrl: process.env.OPENCLAW_URL || "http://localhost:18789",
  requiresKey: true,

  async validateKey(key: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openclaw:main",
          input: "hi",
          max_output_tokens: 1,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async fetchModels(): Promise<Model[]> {
    return OPENCLAW_MODELS.map((m) => ({
      ...m,
      provider: "openclaw",
    }));
  },

  async *chat(config: ChatConfig, apiKey?: string): AsyncGenerator<string> {
    if (!apiKey) throw new Error("API key required");

    // Convert messages to OpenResponses input format
    const systemMsg = config.messages.find((m) => m.role === "system");
    const otherMsgs = config.messages.filter((m) => m.role !== "system");

    const input = otherMsgs.map((m) => ({
      type: "message" as const,
      role: m.role,
      content: m.content,
    }));

    const res = await fetch(`${this.baseUrl}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input,
        ...(systemMsg && { instructions: systemMsg.content }),
        temperature: config.temperature,
        max_output_tokens: config.maxTokens ?? 1024,
        stream: true,
      }),
    });

    if (!res.ok) throw new Error(`OpenClaw error: ${res.status}`);
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
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
              if (json.type === "response.output_text.delta") {
                const text = json.delta;
                if (text) yield text;
              } else if (json.type === "response.failed") {
                throw new Error(json.error?.message || "OpenClaw request failed");
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
