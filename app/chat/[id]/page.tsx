'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Play, Pause, Square, ArrowDown, Download, Send, BarChart3,
  Volume2, VolumeX, Film, Trophy, VenetianMask, X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ChatStats } from '@/components/chat-stats'
import { Scoreboard, ScoreboardData } from '@/components/scoreboard'
import { speak, stopSpeaking, initVoices, isSpeechSupported } from '@/lib/voice'
import { resolveConductor, ConductorSettings } from '@/lib/conductor'

interface Message {
  id: string
  personaId: string
  personaName: string
  model: string
  content: string
  isJudge: boolean
  createdAt: string
}

interface StreamPersona {
  id: string
  name: string
  avatar: string | null
  model: string
  whispered?: boolean
}

interface PersonaInfo {
  id: string
  name: string
  avatar: string | null
}

interface Conversation {
  id: string
  title: string
  topic: string
  mode: string
  personas: string
  judgeId: string | null
  scores: string | null
  messages: Message[]
}

// Conductor settings (history depth, message cap, prompts) come from the
// Prompt Lab on /settings, stored in localStorage `agent-arena-conductor`.
function getConductor(): ConductorSettings {
  try {
    return resolveConductor(JSON.parse(localStorage.getItem('agent-arena-conductor') || '{}'))
  } catch {
    return resolveConductor()
  }
}

export default function ChatPage() {
  const params = useParams()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [currentMessage, setCurrentMessage] = useState<{ persona: StreamPersona; content: string } | null>(null)
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

  // Whisper Mode state
  const [whisper, setWhisper] = useState<{ personaId: string; note: string } | null>(null)
  const [whisperOpen, setWhisperOpen] = useState(false)
  const [whisperTarget, setWhisperTarget] = useState('')
  const [whisperNote, setWhisperNote] = useState('')

  // Voice Mode state
  const [voiceOn, setVoiceOn] = useState(false)

  // Judge state
  const [judging, setJudging] = useState(false)

  // All personas, for avatars + whisper targeting
  const [personaMap, setPersonaMap] = useState<Record<string, PersonaInfo>>({})

  // AbortController for cancelling fetch
  const abortControllerRef = useRef<AbortController | null>(null)

  const { toast } = useToast()

  const combatantIds: string[] = conversation ? JSON.parse(conversation.personas) : []
  const scoreboard: ScoreboardData | null = conversation?.scores
    ? JSON.parse(conversation.scores)
    : conversation?.judgeId
      ? { rounds: 0, lastJudgedCount: 0, totals: {} }
      : null

  const debateCount = (msgs: Message[]) =>
    msgs.filter((m) => !m.isJudge && m.personaId !== 'human').length

  useEffect(() => {
    if (params.id) {
      fetchConversation()
    }
    fetch('/api/personas')
      .then((res) => res.json())
      .then((data: PersonaInfo[]) => {
        const map: Record<string, PersonaInfo> = {}
        for (const p of data) map[p.id] = p
        setPersonaMap(map)
      })
      .catch(() => {})
  }, [params.id])

  // Voice Mode: warm the browser voice cache, restore preference
  useEffect(() => {
    initVoices()
    setVoiceOn(localStorage.getItem('agent-arena-voice') === 'on')
    return () => stopSpeaking()
  }, [])

  const toggleVoice = () => {
    setVoiceOn((prev) => {
      const next = !prev
      localStorage.setItem('agent-arena-voice', next ? 'on' : 'off')
      if (!next) stopSpeaking()
      return next
    })
  }

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
      !judging &&
      conversation &&
      conversation.messages.length > 0 &&
      debateCount(conversation.messages) < getConductor().messageCap
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
  }, [status, autoContinue, autoContinueDelay, judging, conversation?.messages.length])

  // Clean up auto-continue timer on unmount
  useEffect(() => {
    return () => {
      if (autoContinueTimerRef.current) {
        clearTimeout(autoContinueTimerRef.current)
      }
    }
  }, [])

  const fetchConversation = async (): Promise<Conversation | null> => {
    try {
      const res = await fetch(`/api/conversations/${params.id}`)
      const data = await res.json()
      setConversation(data)
      return data
    } catch (err) {
      console.error('Failed to fetch conversation:', err)
      return null
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getApiKeys = () => {
    const keysStr = localStorage.getItem('agent-arena-keys')
    return keysStr ? JSON.parse(keysStr) : {}
  }

  const getApiUrls = () => {
    const urlsStr = localStorage.getItem('agent-arena-urls')
    return urlsStr ? JSON.parse(urlsStr) : {}
  }

  // AI Judge: run a scoring round (or the final verdict)
  const runJudgeRound = useCallback(
    async (final = false) => {
      if (!conversation?.judgeId || judging) return
      setJudging(true)
      try {
        const res = await fetch('/api/chat/judge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: conversation.id, apiKeys: getApiKeys(), apiUrls: getApiUrls(), final }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Judge round failed')
        }
        await fetchConversation()
      } catch (err) {
        console.error('Judge error:', err)
        toast({ title: 'Judge Error', description: (err as Error).message, variant: 'destructive' })
      } finally {
        setJudging(false)
      }
    },
    [conversation?.id, conversation?.judgeId, judging]
  )

  const handleStart = async () => {
    if (!conversation) return

    const controller = new AbortController()
    abortControllerRef.current = controller
    setStatus('running')
    setCurrentMessage(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          apiKeys: getApiKeys(),
          apiUrls: getApiUrls(),
          conductor: getConductor(),
          ...(whisper && { whisper }),
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error('Failed to start chat')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let currentPersona: StreamPersona | null = null

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
                  // Whisper consumed — disarm it
                  if (data.data.whispered) {
                    setWhisper(null)
                  }
                } else if (data.type === 'content' && currentPersona) {
                  setCurrentMessage(prev =>
                    prev ? { ...prev, content: prev.content + data.data } : null
                  )
                } else if (data.type === 'done') {
                  setCurrentMessage(null)
                  if (voiceOn && data.data?.content) {
                    speak(data.data.personaId, data.data.content)
                  }
                  const updated = await fetchConversation()
                  // Auto-judge after every full round (each combatant spoke once more)
                  if (
                    updated?.judgeId &&
                    combatantIds.length > 0
                  ) {
                    const sb: ScoreboardData = updated.scores
                      ? JSON.parse(updated.scores)
                      : { rounds: 0, lastJudgedCount: 0, totals: {} }
                    if (debateCount(updated.messages) - sb.lastJudgedCount >= combatantIds.length) {
                      runJudgeRound(false)
                    }
                  }
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
    stopSpeaking()
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
    stopSpeaking()
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

  const handleArmWhisper = () => {
    if (!whisperTarget || !whisperNote.trim()) return
    setWhisper({ personaId: whisperTarget, note: whisperNote.trim() })
    setWhisperOpen(false)
    setWhisperNote('')
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
  const avatarFor = (msg: Message) => {
    if (msg.personaId === 'human') return '👤'
    if (msg.isJudge) return personaMap[msg.personaId]?.avatar || '⚖️'
    return personaMap[msg.personaId]?.avatar || '🤖'
  }

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

      {/* Live scoreboard (AI Judge) */}
      {scoreboard && (
        <div className="px-4 pt-3">
          <div className="max-w-6xl mx-auto">
            <Scoreboard scoreboard={scoreboard} judging={judging} />
          </div>
        </div>
      )}

      {/* Messages area with optional stats panel */}
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4"
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {allMessages.map((msg) => (
              <Card
                key={msg.id}
                className={
                  msg.isJudge
                    ? 'border-amber-500/60 bg-amber-500/5'
                    : 'hover:shadow-md transition-shadow'
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{avatarFor(msg)}</span>
                      <div>
                        <CardTitle className="text-base">
                          {msg.isJudge ? `⚖️ ${msg.personaName}` : msg.personaName}
                        </CardTitle>
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
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
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
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={handleStart}
                    disabled={status === 'running' || judging}
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

                  {/* Whisper Mode */}
                  {whisper ? (
                    <Badge
                      variant="outline"
                      className="border-violet-500/60 text-violet-500 cursor-pointer gap-1"
                      onClick={() => setWhisper(null)}
                      title="Click to disarm"
                    >
                      <VenetianMask className="h-3 w-3" />
                      Whisper armed: {personaMap[whisper.personaId]?.name || 'persona'}
                      <X className="h-3 w-3" />
                    </Badge>
                  ) : (
                    <Button
                      onClick={() => {
                        setWhisperTarget(combatantIds[0] || '')
                        setWhisperOpen(true)
                      }}
                      variant="outline"
                      size="sm"
                      className="text-violet-500 border-violet-500/40"
                    >
                      <VenetianMask className="mr-2 h-4 w-4" />
                      Whisper
                    </Button>
                  )}

                  {/* Final Verdict (AI Judge) */}
                  {conversation.judgeId && !scoreboard?.winner && (
                    <Button
                      onClick={() => runJudgeRound(true)}
                      disabled={judging || status === 'running' || debateCount(allMessages) === 0}
                      variant="outline"
                      size="sm"
                      className="text-amber-500 border-amber-500/40"
                    >
                      <Trophy className="mr-2 h-4 w-4" />
                      {judging ? 'Deliberating...' : 'Final Verdict'}
                    </Button>
                  )}

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

                  {/* Voice Mode */}
                  {isSpeechSupported() && (
                    <Button
                      onClick={toggleVoice}
                      variant={voiceOn ? 'default' : 'outline'}
                      size="sm"
                      title="Voice Mode: personas speak their messages aloud"
                    >
                      {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </Button>
                  )}

                  {/* Cinematic Replay */}
                  {allMessages.length > 0 && (
                    <Link href={`/chat/${conversation.id}/replay`}>
                      <Button variant="outline" size="sm">
                        <Film className="mr-2 h-4 w-4" />
                        Replay
                      </Button>
                    </Link>
                  )}

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

      {/* Whisper Mode dialog */}
      <Dialog open={whisperOpen} onOpenChange={setWhisperOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <VenetianMask className="h-5 w-5 text-violet-500" />
              Whisper a Director&apos;s Note
            </DialogTitle>
            <DialogDescription>
              Secretly steer one persona&apos;s next turn. The note is injected into their instructions —
              they will follow it but never reveal it, and no one else sees it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {combatantIds.map((id) => {
                const p = personaMap[id]
                if (!p) return null
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setWhisperTarget(id)}
                    className={`p-2 rounded-lg border text-left transition-colors flex items-center gap-2 ${
                      whisperTarget === id
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-border hover:border-violet-500/50'
                    }`}
                  >
                    <span className="text-xl">{p.avatar || '🤖'}</span>
                    <span className="text-sm font-medium">{p.name}</span>
                  </button>
                )
              })}
            </div>
            <Textarea
              value={whisperNote}
              onChange={(e) => setWhisperNote(e.target.value)}
              placeholder='e.g., "Start doubting your own position" or "Get theatrical and challenge them to a duel"'
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhisperOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleArmWhisper}
              disabled={!whisperTarget || !whisperNote.trim()}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <VenetianMask className="mr-2 h-4 w-4" />
              Arm Whisper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
