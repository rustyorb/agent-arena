import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/personas - List all personas
export async function GET() {
  try {
    const personas = await prisma.persona.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(personas)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch personas' },
      { status: 500 }
    )
  }
}

// POST /api/personas - Create a new persona
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const persona = await prisma.persona.create({
      data: {
        name: body.name,
        avatar: body.avatar || null,
        systemPrompt: body.systemPrompt,
        position: body.position || null,
        temperature: body.temperature ?? 0.7,
        maxTokens: body.maxTokens ?? 1024,
        provider: body.provider,
        model: body.model,
      },
    })

    return NextResponse.json(persona, { status: 201 })
  } catch (error) {
    console.error('Failed to create persona:', error)
    return NextResponse.json(
      { error: 'Failed to create persona' },
      { status: 500 }
    )
  }
}
