import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (format === "markdown") {
    const lines: string[] = [
      `# ${conversation.title}`,
      "",
      `**Topic:** ${conversation.topic}  `,
      `**Mode:** ${conversation.mode}  `,
      `**Created:** ${conversation.createdAt.toISOString()}  `,
      `**Messages:** ${conversation.messages.length}`,
      "",
      "---",
    ];

    for (const msg of conversation.messages) {
      lines.push(
        "",
        `### ${msg.personaName} (${msg.model})`,
        `*${msg.createdAt.toISOString()}*`,
        "",
        msg.content,
        "",
        "---"
      );
    }

    const markdown = lines.join("\n");

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="conversation-${params.id}.md"`,
      },
    });
  }

  // Default: JSON format
  const json = JSON.stringify(conversation, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="conversation-${params.id}.json"`,
    },
  });
}
