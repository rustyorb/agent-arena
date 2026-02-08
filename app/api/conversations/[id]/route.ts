import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { title, topic, mode, status } = body;

  const conversation = await prisma.conversation.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(topic !== undefined && { topic }),
      ...(mode !== undefined && { mode }),
      ...(status !== undefined && { status }),
    },
  });

  return NextResponse.json(conversation);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const existing = await prisma.conversation.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.conversation.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
