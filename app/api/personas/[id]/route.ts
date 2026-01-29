import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/personas/:id - Get a single persona
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const persona = await prisma.persona.findUnique({
      where: { id: params.id },
    })

    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(persona)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch persona' },
      { status: 500 }
    )
  }
}

// PUT /api/personas/:id - Update a persona
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    const persona = await prisma.persona.update({
      where: { id: params.id },
      data: {
        name: body.name,
        avatar: body.avatar || null,
        systemPrompt: body.systemPrompt,
        position: body.position || null,
        temperature: body.temperature || 0.7,
        maxTokens: body.maxTokens || 1024,
        provider: body.provider,
        model: body.model,
      },
    })

    return NextResponse.json(persona)
  } catch (error) {
    console.error('Failed to update persona:', error)
    return NextResponse.json(
      { error: 'Failed to update persona' },
      { status: 500 }
    )
  }
}

// DELETE /api/personas/:id - Delete a persona
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.persona.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete persona:', error)
    return NextResponse.json(
      { error: 'Failed to delete persona' },
      { status: 500 }
    )
  }
}
