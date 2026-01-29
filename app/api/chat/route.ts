import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getProvider } from '@/lib/providers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { conversationId, apiKeys } = body

    // Fetch conversation with personas
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const personaIds = JSON.parse(conversation.personas)
    const personas = await prisma.persona.findMany({
      where: { id: { in: personaIds } }
    })

    // Determine next speaker (simple round-robin for now)
    const messageCount = conversation.messages.length
    const nextPersonaIndex = messageCount % personas.length
    const speaker = personas[nextPersonaIndex]

    // Build conversation history for context
    const messages = conversation.messages.slice(-10).map(msg => ({
      role: msg.personaId === speaker.id ? 'assistant' : 'user',
      content: `${msg.personaName}: ${msg.content}`
    }))

    // Add system prompt
    messages.unshift({
      role: 'system',
      content: speaker.systemPrompt
    })

    // Add the topic/prompt
    if (conversation.messages.length === 0) {
      messages.push({
        role: 'user',
        content: `You are discussing: "${conversation.topic}". Start the conversation with your perspective.`
      })
    } else {
      messages.push({
        role: 'user',
        content: `It's your turn to respond. Continue the discussion.`
      })
    }

    // Get provider and stream response
    const provider = getProvider(speaker.provider)
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 400 })
    }

    const providerKey = speaker.provider.toLowerCase().replace(/[^a-z]/g, '')
    const apiKey = apiKeys[providerKey]

    // Create a readable stream for SSE
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = ''

        try {
          const chatStream = provider.chat({
            model: speaker.model,
            messages: messages as any,
            temperature: speaker.temperature,
            maxTokens: speaker.maxTokens,
            apiKey,
          })

          // Send persona info first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'persona', 
              data: {
                id: speaker.id,
                name: speaker.name,
                avatar: speaker.avatar,
                model: speaker.model
              }
            })}\n\n`)
          )

          // Stream content chunks
          for await (const chunk of chatStream) {
            fullContent += chunk
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'content', data: chunk })}\n\n`)
            )
          }

          // Save complete message to database
          await prisma.message.create({
            data: {
              conversationId,
              personaId: speaker.id,
              personaName: speaker.name,
              model: speaker.model,
              content: fullContent,
            }
          })

          // Send done signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          )
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              data: error instanceof Error ? error.message : 'Unknown error'
            })}\n\n`)
          )
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
