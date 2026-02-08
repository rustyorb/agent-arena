import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const messages = await prisma.message.findMany({
    where: { conversationId: params.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { content, personaId, personaName, model } = body;

  if (!content || !personaId || !personaName || !model) {
    return NextResponse.json(
      { error: "Missing required fields: content, personaId, personaName, model" },
      { status: 400 }
    );
  }

  // Verify conversation exists
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const message = await prisma.message.create({
    data: {
      conversationId: params.id,
      personaId,
      personaName,
      model,
      content,
    },
  });

  return NextResponse.json(message, { status: 201 });
}
