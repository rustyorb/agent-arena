import { AIProvider, Model, ChatConfig } from "./types";

export const ollama: AIProvider = {
  name: "Ollama",
  id: "ollama",
  baseUrl: process.env.OLLAMA_URL || "http://192.168.0.177:11434",
  requiresKey: false,

  async validateKey(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  },

  async fetchModels(): Promise<Model[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        provider: "ollama",
      }));
    } catch {
      return [];
    }
  },

  async *chat(config: ChatConfig): AsyncGenerator<string> {
    // Convert to Ollama format
    const systemMsg = config.messages.find((m) => m.role === "system");
    const otherMsgs = config.messages.filter((m) => m.role !== "system");

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: otherMsgs.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        ...(systemMsg && { system: systemMsg.content }),
        options: {
          temperature: config.temperature ?? 0.7,
          num_predict: config.maxTokens ?? 1024,
        },
        stream: true,
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
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
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) yield json.message.content;
          if (json.done) return;
        } catch {}
      }
    }
  },
};
