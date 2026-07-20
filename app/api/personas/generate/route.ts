import { NextRequest, NextResponse } from "next/server";
import { resolveProvider, ChatMessage } from "@/lib/providers";
import { extractJson } from "@/lib/extract-json";

// POST /api/personas/generate — Persona Forge
// Generates persona fields with AI. Three modes:
//   - seed provided: invent the persona from the seed concept
//   - existing fields provided: keep them, fill in the rest
//   - neither: full willy-nilly random persona
// Body: { seed?, existing?: { name?, avatar?, systemPrompt?, position? }, provider, model, apiKeys, apiUrls? }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { seed, existing = {}, provider: providerId, model, apiKeys = {}, apiUrls = {} } = body;

  if (!providerId || !model) {
    return NextResponse.json({ error: "Missing provider or model" }, { status: 400 });
  }

  const provider = resolveProvider(providerId, apiUrls[providerId]);
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 });
  }

  const locked = Object.entries(existing)
    .filter(([, v]) => typeof v === "string" && v.trim() !== "")
    .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
    .join("\n");

  const systemPrompt = `You are the Persona Forge: a designer of vivid AI debate personas for a multi-agent conversation arena. Personas you create will argue, debate, and banter with each other.

Respond with ONLY a JSON object, no other text:
{"name":"short memorable name","avatar":"exactly one emoji","systemPrompt":"2-4 sentences written in second person ('You are ...') defining personality, speaking style, and quirks","position":"short debate stance or null","temperature":0.9}

Rules:
- temperature is a number between 0.0 and 2.0 matching how wild the persona is
- systemPrompt must make the persona entertaining and DISTINCT — strong voice, strong opinions
- avatar must be a single emoji character`;

  let userContent: string;
  if (seed && seed.trim()) {
    userContent = `Forge a persona from this seed concept: "${seed.trim()}"`;
  } else if (locked) {
    userContent = `Forge a persona. The user already filled in these fields — keep them EXACTLY as given and design the remaining fields to match:\n${locked}`;
  } else {
    userContent =
      "Forge a completely unexpected persona. No constraints. Go willy-nilly: surprise me with something wildly creative that would be hilarious or fascinating in a debate arena.";
  }
  // Seed + partial form: seed drives, form constrains
  if (seed && seed.trim() && locked) {
    userContent += `\n\nThe user also pre-filled these fields — keep them EXACTLY as given:\n${locked}`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  try {
    let fullText = "";
    const generator = provider.chat(
      { model, messages, temperature: 1.0, maxTokens: 1024 },
      apiKeys[providerId]
    );
    for await (const chunk of generator) {
      fullText += chunk;
    }

    const result = extractJson(fullText);

    // Locked fields always win over what the model returned
    const persona = {
      name: existing.name?.trim() || String(result.name || "Unnamed"),
      avatar: existing.avatar?.trim() || String(result.avatar || "🎭"),
      systemPrompt: existing.systemPrompt?.trim() || String(result.systemPrompt || ""),
      position: existing.position?.trim() || (result.position ? String(result.position) : ""),
      temperature:
        typeof result.temperature === "number"
          ? Math.min(2, Math.max(0, result.temperature))
          : 0.9,
    };

    return NextResponse.json(persona);
  } catch (error) {
    console.error("Persona generation error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Generation failed" },
      { status: 500 }
    );
  }
}
