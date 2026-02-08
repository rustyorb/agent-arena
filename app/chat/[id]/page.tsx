'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Play, Pause, Square, ArrowDown, Download, Send, BarChart3 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ChatStats } from '@/components/chat-stats'

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

  // Auto-continue state
  const [autoContinue, setAutoContinue] = useState(false)
  const [autoContinueDelay, setAutoContinueDelay] = useState(2)
  const autoContinueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Human message injection state
  const [humanMessage, setHumanMessage] = useState('')

  // Stats panel state
  const [showStats, setShowStats] = useState(false)

  // AbortController for cancelling fetch
  const abortControllerRef = useRef<AbortController | null>(null)

  const { toast } = useToast()

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

  // Auto-continue effect: when status returns to 'idle' and autoContinue is on
  useEffect(() => {
    if (
      autoContinue &&
      status === 'idle' &&
      conversation &&
      conversation.messages.length > 0 &&
      conversation.messages.length < 20
    ) {
      autoContinueTimerRef.current = setTimeout(() => {
        handleStart()
      }, autoContinueDelay * 1000)
    }

    return () => {
      if (autoContinueTimerRef.current) {
        clearTimeout(autoContinueTimerRef.current)
        autoContinueTimerRef.current = null
      }
    }
  }, [status, autoContinue, autoContinueDelay, conversation?.messages.length])

  // Clean up auto-continue timer on unmount
  useEffect(() => {
    return () => {
      if (autoContinueTimerRef.current) {
        clearTimeout(autoContinueTimerRef.current)
      }
    }
  }, [])

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

    const controller = new AbortController()
    abortControllerRef.current = controller
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
        signal: controller.signal,
      })

      if (!response.ok) throw new Error('Failed to start chat')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let currentPersona: Persona | null = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
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
                  await fetchConversation()
                } else if (data.type === 'error') {
                  console.error('Stream error:', data.data)
                  toast({ title: 'Stream Error', description: String(data.data), variant: 'destructive' })
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error('Chat error:', err)
      toast({ title: 'Error', description: 'Failed to execute turn', variant: 'destructive' })
    } finally {
      abortControllerRef.current = null
      setStatus('idle')
    }
  }

  const handlePause = () => {
    setStatus('paused')
    setAutoContinue(false)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (autoContinueTimerRef.current) {
      clearTimeout(autoContinueTimerRef.current)
      autoContinueTimerRef.current = null
    }
  }

  const handleStop = () => {
    setStatus('idle')
    setCurrentMessage(null)
    setAutoContinue(false)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (autoContinueTimerRef.current) {
      clearTimeout(autoContinueTimerRef.current)
      autoContinueTimerRef.current = null
    }
  }

  const handleSendHumanMessage = async () => {
    if (!humanMessage.trim() || !conversation) return

    try {
      const res = await fetch(`/api/conversations/${params.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: humanMessage.trim(),
          personaId: 'human',
          personaName: 'Human',
          model: 'human',
        }),
      })

      if (!res.ok) throw new Error('Failed to send message')

      setHumanMessage('')
      await fetchConversation()
    } catch (err) {
      console.error('Failed to send human message:', err)
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' })
    }
  }

  const handleExport = async (format: 'markdown' | 'json') => {
    try {
      const res = await fetch(`/api/conversations/${params.id}/export?format=${format}`)
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `conversation-${params.id}.${format === 'markdown' ? 'md' : 'json'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
      toast({ title: 'Error', description: 'Failed to export conversation', variant: 'destructive' })
    }
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading conversation...</p>
      </div>
    )
  }

  const allMessages = conversation.messages

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

      {/* Messages area with optional stats panel */}
      <div className="flex flex-1 overflow-hidden">
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
                      <span className="text-2xl">{msg.personaId === 'human' ? '\uD83D\uDC64' : '\uD83E\uDD16'}</span>
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
                    <span className="text-2xl">{currentMessage.persona.avatar || '\uD83E\uDD16'}</span>
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

        {/* Stats panel */}
        {showStats && (
          <div className="w-80 border-l overflow-y-auto p-4">
            <ChatStats messages={conversation.messages} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t p-4 bg-background">
        <div className="max-w-6xl mx-auto space-y-3">
          {/* Human message injection */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Inject a human message..."
              value={humanMessage}
              onChange={(e) => setHumanMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendHumanMessage()
                }
              }}
              disabled={status === 'running'}
            />
            <Button
              onClick={handleSendHumanMessage}
              disabled={status === 'running' || !humanMessage.trim()}
              size="sm"
            >
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </div>

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

                  <div className="flex items-center gap-2 ml-4 border-l pl-4">
                    <Switch
                      checked={autoContinue}
                      onCheckedChange={setAutoContinue}
                    />
                    <span className="text-sm whitespace-nowrap">Auto-continue</span>
                  </div>

                  {autoContinue && (
                    <div className="flex items-center gap-2 ml-2">
                      <Slider
                        value={[autoContinueDelay]}
                        onValueChange={([val]) => setAutoContinueDelay(val)}
                        min={0.5}
                        max={10}
                        step={0.5}
                        className="w-24"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {autoContinueDelay}s
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {allMessages.length} messages
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleExport('markdown')}>
                        Export as Markdown
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('json')}>
                        Export as JSON
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    onClick={() => setShowStats(prev => !prev)}
                    variant={showStats ? 'default' : 'outline'}
                    size="sm"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Stats
                  </Button>

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
