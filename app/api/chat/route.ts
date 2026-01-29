import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { providers, ProviderId } from "@/lib/providers";

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
    prompt,
    apiKey,
  } = body;

  const provider = providers[providerId as ProviderId];
  if (!provider) {
    return new Response("Unknown provider", { status: 400 });
  }

  // Create a streaming response
  const encoder = new TextEncoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const chatGenerator = provider.chat(
          {
            model,
            messages: [
              { role: "user", content: prompt },
            ],
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
