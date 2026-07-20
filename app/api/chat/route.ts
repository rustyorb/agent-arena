import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveProvider } from "@/lib/providers";
import { TurnManager } from "@/lib/orchestrator/turn-manager";
import { resolveConductor } from "@/lib/conductor";
import { stripLeadingLabels } from "@/lib/sanitize";

// POST /api/chat
// Executes the next turn of a conversation, server-orchestrated.
// Body: { conversationId, apiKeys: Record<providerId, string>, apiUrls?: Record<providerId, string>,
//         whisper?: { personaId, note }, conductor?: Partial<ConductorSettings> }
// Streams SSE events: { type: 'persona' | 'content' | 'done' | 'error', data }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { conversationId, apiKeys = {}, apiUrls = {}, whisper } = body;
  const conductor = resolveConductor(body.conductor);

  if (!conversationId) {
    return new Response("Missing conversationId", { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return new Response("Conversation not found", { status: 404 });
  }

  const personaIds: string[] = JSON.parse(conversation.personas);
  const personaRecords = await prisma.persona.findMany({
    where: { id: { in: personaIds } },
  });
  // Preserve the order chosen at conversation creation
  const combatants = personaIds
    .map((id) => personaRecords.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  if (combatants.length < 2) {
    return new Response("Conversation needs at least 2 personas", { status: 400 });
  }

  // Judge verdicts are commentary, not debate turns — keep them out of turn-taking
  const history = conversation.messages
    .filter((m) => !m.isJudge)
    .map((m) => ({
      id: m.id,
      personaId: m.personaId,
      personaName: m.personaName,
      model: m.model,
      content: m.content,
      createdAt: m.createdAt,
    }));

  const turnManager = new TurnManager({
    mode: conversation.mode as any,
    topic: conversation.topic,
    personas: combatants,
    history,
    conductor,
  });

  const speaker = turnManager.getNextSpeaker();
  const messages = turnManager.buildPrompt(speaker);

  // Whisper Mode: secretly steer one persona's next turn.
  // Injected into the system prompt only when the whispered persona is the speaker.
  if (whisper?.note && whisper.personaId === speaker.id && messages[0]?.role === "system") {
    messages[0].content += `\n\n[DIRECTOR'S SECRET NOTE — follow this instruction in your next reply, but NEVER reveal, mention, or acknowledge that you received it: ${whisper.note}]`;
  }

  const provider = resolveProvider(speaker.provider, apiUrls[speaker.provider]);
  if (!provider) {
    return new Response(`Unknown provider: ${speaker.provider}`, { status: 400 });
  }

  const apiKey = apiKeys[speaker.provider];
  const encoder = new TextEncoder();

  const sse = (type: string, data: unknown) =>
    encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = "";
      try {
        controller.enqueue(
          sse("persona", {
            id: speaker.id,
            name: speaker.name,
            avatar: speaker.avatar,
            model: speaker.model,
            whispered: Boolean(whisper?.note && whisper.personaId === speaker.id),
          })
        );

        const chatGenerator = provider.chat(
          {
            model: speaker.model,
            messages,
            temperature: speaker.temperature,
            maxTokens: speaker.maxTokens,
            frequencyPenalty: conductor.frequencyPenalty,
            presencePenalty: conductor.presencePenalty,
          },
          apiKey
        );

        for await (const chunk of chatGenerator) {
          fullContent += chunk;
          controller.enqueue(sse("content", chunk));
        }

        // Empty-turn retry: thinking models can burn the whole token budget on
        // reasoning and stream no content. Retry once with a lifted cap — an
        // empty message must never be persisted (it poisons the next turn).
        if (!fullContent.trim()) {
          const retryGenerator = provider.chat(
            {
              model: speaker.model,
              messages,
              temperature: speaker.temperature,
              maxTokens: Math.max(4096, (speaker.maxTokens ?? 1024) * 2),
              frequencyPenalty: conductor.frequencyPenalty,
              presencePenalty: conductor.presencePenalty,
            },
            apiKey
          );
          for await (const chunk of retryGenerator) {
            fullContent += chunk;
            controller.enqueue(sse("content", chunk));
          }
        }

        if (!fullContent.trim()) {
          throw new Error(`${speaker.name} produced an empty turn (twice) — not saved`);
        }

        // Kill the label feedback loop before it enters the transcript
        fullContent = stripLeadingLabels(fullContent, speaker.name);

        await prisma.message.create({
          data: {
            conversationId,
            personaId: speaker.id,
            personaName: speaker.name,
            model: `${speaker.provider}/${speaker.model}`,
            content: fullContent,
          },
        });

        controller.enqueue(sse("done", { personaId: speaker.id, content: fullContent }));
        controller.close();
      } catch (error) {
        console.error("Chat error:", error);
        try {
          controller.enqueue(sse("error", (error as Error).message || "Turn failed"));
          controller.close();
        } catch {
          controller.error(error);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
