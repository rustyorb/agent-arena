// Conductor settings: the orchestration prompts + context knobs that shape
// every turn. Editable on /settings (Prompt Lab), stored per-browser in
// localStorage `agent-arena-conductor`, sent with each /api/chat request.

export interface ConductorSettings {
  historyDepth: number; // how many recent messages each persona sees
  messageCap: number; // debate messages before the conversation auto-stops
  openingPrompt: string; // first turn; {topic} is replaced with the conversation topic
  turnPrompt: string; // every subsequent turn
  styleSuffix: string; // appended to every persona's system prompt
}

export const DEFAULT_CONDUCTOR: ConductorSettings = {
  historyDepth: 40,
  messageCap: 20,
  openingPrompt:
    'You are discussing: "{topic}". Start the conversation with your perspective.',
  turnPrompt:
    "It's your turn to respond. React directly to what was just said — agree, attack, or build on it — then push the discussion somewhere NEW: a fresh argument, a concrete example, a pointed question, or a concession. Do not repeat points already made in the conversation.",
  styleSuffix:
    "IMPORTANT: Keep your responses concise (2-3 paragraphs max). Be direct and engaging. Never restate arguments you have already made — advance them instead.",
};

// Merge a partial (possibly untrusted) conductor with defaults, clamping numbers.
export function resolveConductor(partial?: Partial<ConductorSettings>): ConductorSettings {
  const merged = { ...DEFAULT_CONDUCTOR, ...(partial || {}) };
  merged.historyDepth = Math.min(500, Math.max(1, Number(merged.historyDepth) || DEFAULT_CONDUCTOR.historyDepth));
  merged.messageCap = Math.min(500, Math.max(2, Number(merged.messageCap) || DEFAULT_CONDUCTOR.messageCap));
  merged.openingPrompt = String(merged.openingPrompt || DEFAULT_CONDUCTOR.openingPrompt);
  merged.turnPrompt = String(merged.turnPrompt || DEFAULT_CONDUCTOR.turnPrompt);
  merged.styleSuffix = String(merged.styleSuffix ?? DEFAULT_CONDUCTOR.styleSuffix);
  return merged;
}
