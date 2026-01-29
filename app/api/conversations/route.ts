import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/conversations - List all conversations
export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    })
    
    // Add status field (not in DB, computed)
    const withStatus = conversations.map(conv => ({
      ...conv,
      status: 'stopped' // default status
    }))
    
    return NextResponse.json(withStatus)
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const conversation = await prisma.conversation.create({
      data: {
        title: body.title,
        topic: body.topic,
        mode: body.mode,
        personas: JSON.stringify(body.personas), // Store as JSON string
      },
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}
