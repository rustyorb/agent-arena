import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveProvider, ChatMessage } from "@/lib/providers";
import { extractJson } from "@/lib/extract-json";

export interface PersonaTotals {
  name: string;
  logic: number;
  persuasion: number;
  style: number;
  total: number;
}

export interface Scoreboard {
  rounds: number;
  lastJudgedCount: number;
  totals: Record<string, PersonaTotals>;
  winner?: { personaId: string; name: string; statement: string };
}

// POST /api/chat/judge
// Runs a judging round (or final verdict) for a conversation with an assigned judge.
// Body: { conversationId, apiKeys, apiUrls?, final?: boolean }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { conversationId, apiKeys = {}, apiUrls = {}, final = false } = body;

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (!conversation.judgeId) {
    return NextResponse.json({ error: "Conversation has no judge" }, { status: 400 });
  }

  const judge = await prisma.persona.findUnique({ where: { id: conversation.judgeId } });
  if (!judge) {
    return NextResponse.json({ error: "Judge persona not found" }, { status: 404 });
  }

  const personaIds: string[] = JSON.parse(conversation.personas);
  const combatants = await prisma.persona.findMany({ where: { id: { in: personaIds } } });

  const scoreboard: Scoreboard = conversation.scores
    ? JSON.parse(conversation.scores)
    : { rounds: 0, lastJudgedCount: 0, totals: {} };

  const debateMessages = conversation.messages.filter((m) => !m.isJudge && m.personaId !== "human");
  const newMessages = debateMessages.slice(scoreboard.lastJudgedCount);

  if (!final && newMessages.length === 0) {
    return NextResponse.json({ error: "Nothing new to judge" }, { status: 400 });
  }

  // Recent context + everything unjudged
  const contextBefore = debateMessages
    .slice(Math.max(0, scoreboard.lastJudgedCount - 4), scoreboard.lastJudgedCount)
    .map((m) => `${m.personaName}: ${m.content}`)
    .join("\n\n");
  const transcript = newMessages.map((m) => `${m.personaName}: ${m.content}`).join("\n\n");

  const combatantList = combatants
    .map((c) => `- ${c.name} (personaId: "${c.id}")`)
    .join("\n");

  const rubric = `You are judging a multi-agent debate on the topic: "${conversation.topic}".

Combatants:
${combatantList}

Score each combatant on this round: logic (0-10), persuasion (0-10), style (0-10). Be opinionated and entertaining but fair.

Respond with ONLY a JSON object, no other text:
{"scores":[{"personaId":"...","personaName":"...","logic":7,"persuasion":8,"style":6,"quip":"one-line zinger about their performance"}],"verdict":"one colorful sentence summarizing the round"${
    final ? ',"winner":{"personaId":"...","statement":"dramatic closing statement declaring the overall winner and why"}' : ""
  }}`;

  const systemPrompt = `${judge.systemPrompt}\n\n${rubric}`;

  const userContent = final
    ? `FINAL VERDICT TIME. Here are the closing exchanges:\n\n${transcript || contextBefore}\n\nScore the final round and declare the overall winner of the entire debate.`
    : `${contextBefore ? `Previous context:\n${contextBefore}\n\n---\n\n` : ""}Judge this round:\n\n${transcript}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const provider = resolveProvider(judge.provider, apiUrls[judge.provider]);
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${judge.provider}` }, { status: 400 });
  }

  try {
    let fullText = "";
    const generator = provider.chat(
      {
        model: judge.model,
        messages,
        temperature: judge.temperature,
        maxTokens: judge.maxTokens,
      },
      apiKeys[judge.provider]
    );
    for await (const chunk of generator) {
      fullText += chunk;
    }

    const result = extractJson(fullText);
    const scores: Array<{
      personaId: string;
      personaName: string;
      logic: number;
      persuasion: number;
      style: number;
      quip?: string;
    }> = result.scores || [];

    // Accumulate the scoreboard
    for (const s of scores) {
      const prev = scoreboard.totals[s.personaId] || {
        name: s.personaName,
        logic: 0,
        persuasion: 0,
        style: 0,
        total: 0,
      };
      prev.logic += s.logic || 0;
      prev.persuasion += s.persuasion || 0;
      prev.style += s.style || 0;
      prev.total = prev.logic + prev.persuasion + prev.style;
      scoreboard.totals[s.personaId] = prev;
    }
    scoreboard.rounds += 1;
    scoreboard.lastJudgedCount = debateMessages.length;

    if (final && result.winner?.personaId) {
      const winnerPersona = combatants.find((c) => c.id === result.winner.personaId);
      scoreboard.winner = {
        personaId: result.winner.personaId,
        name: winnerPersona?.name || result.winner.personaId,
        statement: result.winner.statement || "",
      };
    }

    // Human-readable verdict message, rendered as a gold judge card in the chat
    const lines = scores.map(
      (s) =>
        `**${s.personaName}** — Logic ${s.logic}/10 · Persuasion ${s.persuasion}/10 · Style ${s.style}/10${s.quip ? ` — "${s.quip}"` : ""}`
    );
    const verdictText = [
      final ? `🏛️ FINAL VERDICT` : `⚖️ Round ${scoreboard.rounds} Verdict`,
      ...lines,
      result.verdict ? `\n${result.verdict}` : "",
      scoreboard.winner ? `\n🏆 WINNER: ${scoreboard.winner.name} — ${scoreboard.winner.statement}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          personaId: judge.id,
          personaName: judge.name,
          model: `${judge.provider}/${judge.model}`,
          content: verdictText,
          isJudge: true,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { scores: JSON.stringify(scoreboard) },
      }),
    ]);

    return NextResponse.json({ scoreboard, verdict: result.verdict, final });
  } catch (error) {
    console.error("Judge error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Judge round failed" },
      { status: 500 }
    );
  }
}
