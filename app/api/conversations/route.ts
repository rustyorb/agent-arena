import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json(conversations);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const conversation = await prisma.conversation.create({
    data: {
      title: body.title,
      topic: body.topic,
      mode: body.mode,
      personas: JSON.stringify(body.personas),
      status: "created",
    },
  });
  
  return NextResponse.json(conversation);
}
