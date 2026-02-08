import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { providers, ProviderId, ChatMessage } from "@/lib/providers";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    conversationId,
    personaId,
    personaName,
    provider: providerId,
    model,
    temperature,
    maxTokens,
    systemPrompt,
    prompt,
    apiKey,
  } = body;

  if (!conversationId || !personaId || !personaName || !providerId || !model) {
    return new Response("Missing required fields", { status: 400 });
  }

  const provider = providers[providerId as ProviderId];
  if (!provider) {
    return new Response("Unknown provider", { status: 400 });
  }

  // Build messages with conversation history
  const messages: ChatMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  // Load recent conversation history from database
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  for (const msg of history) {
    messages.push({
      role: msg.personaId === personaId ? "assistant" : "user",
      content: `${msg.personaName}: ${msg.content}`,
    });
  }

  // Add the current turn prompt
  messages.push({ role: "user", content: prompt || "It's your turn to respond. Continue the discussion." });

  // Create a streaming response
  const encoder = new TextEncoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const chatGenerator = provider.chat(
          {
            model,
            messages,
            temperature,
            maxTokens,
          },
          apiKey
        );

        for await (const chunk of chatGenerator) {
          fullContent += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        // Save message to database
        await prisma.message.create({
          data: {
            conversationId,
            personaId,
            personaName,
            model: `${providerId}/${model}`,
            content: fullContent,
          },
        });

        controller.close();
      } catch (error) {
        console.error("Chat error:", error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
