// Conductor settings: the orchestration prompts + context knobs that shape
// every turn. Editable on /settings (Prompt Lab), stored per-browser in
// localStorage `agent-arena-conductor`, sent with each /api/chat request.

export interface ConductorSettings {
  historyDepth: number; // how many recent messages each persona sees
  messageCap: number; // debate messages before the conversation auto-stops
  openingPrompt: string; // first turn; {topic} is replaced with the conversation topic
  turnPrompt: string; // every subsequent turn
  styleSuffix: string; // appended to every persona's system prompt
  frequencyPenalty: number; // 0-2; discourages repeating the same phrasing
  presencePenalty: number; // 0-2; encourages new topics
}

export const DEFAULT_CONDUCTOR: ConductorSettings = {
  historyDepth: 40,
  messageCap: 20,
  openingPrompt:
    'The conversation topic is: "{topic}". Open the conversation in your own voice — set the tone and give the others something to respond to.',
  turnPrompt:
    "Continue the conversation naturally. React to what was just said, then take it somewhere it hasn't been yet — a new idea, a question, a story, an angle, a feeling. Reach for fresh phrasing rather than echoing earlier lines.",
  styleSuffix:
    "Speak only as yourself, in the first person — give just your own lines, and leave the other speakers' lines to them. Reply with your words directly: no name tag, label, or prefix in front of them. Keep replies conversational, roughly a short paragraph or two. Engage with what was said and keep the conversation building rather than wrapping up.",
  frequencyPenalty: 0.4,
  presencePenalty: 0.3,
};

// Extra seasoning appended to the turn instruction per conversation mode.
// Free conversation is the primary use case and gets no seasoning.
export const MODE_SEASONING: Record<string, string> = {
  debate:
    "Advance your strongest point that has not yet been made, and rebut the most recent opposing point directly.",
  interview: "If you are the interviewer, ask one sharp question; otherwise answer fully, then add something unexpected.",
};

// Merge a partial (possibly untrusted) conductor with defaults, clamping numbers.
export function resolveConductor(partial?: Partial<ConductorSettings>): ConductorSettings {
  const merged = { ...DEFAULT_CONDUCTOR, ...(partial || {}) };
  merged.historyDepth = Math.min(500, Math.max(1, Number(merged.historyDepth) || DEFAULT_CONDUCTOR.historyDepth));
  merged.messageCap = Math.min(500, Math.max(2, Number(merged.messageCap) || DEFAULT_CONDUCTOR.messageCap));
  merged.openingPrompt = String(merged.openingPrompt || DEFAULT_CONDUCTOR.openingPrompt);
  merged.turnPrompt = String(merged.turnPrompt || DEFAULT_CONDUCTOR.turnPrompt);
  merged.styleSuffix = String(merged.styleSuffix ?? DEFAULT_CONDUCTOR.styleSuffix);
  merged.frequencyPenalty = clampPenalty(merged.frequencyPenalty, DEFAULT_CONDUCTOR.frequencyPenalty);
  merged.presencePenalty = clampPenalty(merged.presencePenalty, DEFAULT_CONDUCTOR.presencePenalty);
  return merged;
}

function clampPenalty(value: unknown, fallback: number): number {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(2, Math.max(0, n));
}
