'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Square, ArrowDown } from 'lucide-react'

interface Message {
  id: string
  personaId: string
  personaName: string
  model: string
  content: string
  createdAt: string
}

interface Persona {
  id: string
  name: string
  avatar: string | null
  model: string
}

interface Conversation {
  id: string
  title: string
  topic: string
  mode: string
  messages: Message[]
}

export default function ChatPage() {
  const params = useParams()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [currentMessage, setCurrentMessage] = useState<{ persona: Persona; content: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle')
  const [autoScroll, setAutoScroll] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (params.id) {
      fetchConversation()
    }
  }, [params.id])

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom()
    }
  }, [conversation?.messages, currentMessage])

  const fetchConversation = async () => {
    try {
      const res = await fetch(`/api/conversations/${params.id}`)
      const data = await res.json()
      setConversation(data)
    } catch (err) {
      console.error('Failed to fetch conversation:', err)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleStart = async () => {
    if (!conversation) return
    
    setStatus('running')
    setCurrentMessage(null)

    try {
      // Get API keys from localStorage
      const keysStr = localStorage.getItem('api-keys')
      const apiKeys = keysStr ? JSON.parse(keysStr) : {}

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          apiKeys,
        }),
      })

      if (!response.ok) throw new Error('Failed to start chat')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let currentPersona: Persona | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'persona') {
              currentPersona = data.data
              setCurrentMessage({ persona: data.data, content: '' })
            } else if (data.type === 'content' && currentPersona) {
              setCurrentMessage(prev => 
                prev ? { ...prev, content: prev.content + data.data } : null
              )
            } else if (data.type === 'done') {
              setCurrentMessage(null)
              await fetchConversation() // Refresh to get saved message
            } else if (data.type === 'error') {
              console.error('Stream error:', data.data)
              alert('Error: ' + data.data)
            }
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      alert('Failed to execute turn')
    } finally {
      setStatus('idle')
    }
  }

  const handlePause = () => {
    setStatus('paused')
    // In a real implementation, we'd need to handle pausing the stream
  }

  const handleStop = () => {
    setStatus('idle')
    setCurrentMessage(null)
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading conversation...</p>
      </div>
    )
  }

  const allMessages = [...conversation.messages]

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">{conversation.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{conversation.topic}</p>
          </div>
          <Badge variant="outline">{conversation.mode}</Badge>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {allMessages.map((msg) => (
            <Card key={msg.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <CardTitle className="text-base">{msg.personaName}</CardTitle>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {msg.model}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {msg.content}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Current streaming message */}
          {currentMessage && (
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{currentMessage.persona.avatar || '🤖'}</span>
                  <div>
                    <CardTitle className="text-base">{currentMessage.persona.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {currentMessage.persona.model}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {currentMessage.content}
                  <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Controls */}
      <div className="border-t p-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleStart}
                    disabled={status === 'running'}
                    size="sm"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {status === 'running' ? 'Running...' : 'Next Turn'}
                  </Button>
                  
                  <Button
                    onClick={handlePause}
                    disabled={status !== 'running'}
                    variant="outline"
                    size="sm"
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                  
                  <Button
                    onClick={handleStop}
                    disabled={status === 'idle'}
                    variant="outline"
                    size="sm"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {allMessages.length} messages
                  </div>
                  <Button
                    onClick={scrollToBottom}
                    variant="ghost"
                    size="sm"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
