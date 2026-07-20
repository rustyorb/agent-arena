'use client'

// Cinematic Replay: re-watch a conversation as a typewriter-effect performance
// with playback speed control. Pure client — no API changes.

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Play, Pause, RotateCcw, ArrowLeft, Film } from 'lucide-react'
import { looksLikeAsciiArt } from '@/lib/ascii-art'

interface Message {
  id: string
  personaId: string
  personaName: string
  model: string
  content: string
  isJudge: boolean
  createdAt: string
}

interface Conversation {
  id: string
  title: string
  topic: string
  mode: string
  messages: Message[]
}

interface PersonaInfo {
  id: string
  name: string
  avatar: string | null
}

const BASE_CHARS_PER_TICK = 2
const TICK_MS = 30

export default function ReplayPage() {
  const params = useParams()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [personaMap, setPersonaMap] = useState<Record<string, PersonaInfo>>({})

  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [msgIndex, setMsgIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)

  const bottomRef = useRef<HTMLDivElement>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/conversations/${params.id}`)
      .then((res) => res.json())
      .then(setConversation)
      .catch(() => {})
    fetch('/api/personas')
      .then((res) => res.json())
      .then((data: PersonaInfo[]) => {
        const map: Record<string, PersonaInfo> = {}
        for (const p of data) map[p.id] = p
        setPersonaMap(map)
      })
      .catch(() => {})
  }, [params.id])

  const messages = conversation?.messages || []
  const finished = msgIndex >= messages.length

  // The typewriter engine
  useEffect(() => {
    if (!playing || finished || messages.length === 0) return

    const timer = setInterval(() => {
      setCharIndex((prevChar) => {
        const current = messages[msgIndex]
        if (!current) return prevChar
        const step = Math.max(1, Math.round(BASE_CHARS_PER_TICK * speedRef.current * 2))
        const next = prevChar + step
        if (next >= current.content.length) {
          // Message complete — brief beat, then advance
          setMsgIndex((i) => i + 1)
          return 0
        }
        return next
      })
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [playing, msgIndex, finished, messages.length])

  useEffect(() => {
    if (finished) setPlaying(false)
  }, [finished])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [charIndex, msgIndex])

  const restart = () => {
    setMsgIndex(0)
    setCharIndex(0)
    setPlaying(true)
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading replay...</p>
      </div>
    )
  }

  const avatarFor = (msg: Message) => {
    if (msg.personaId === 'human') return '👤'
    if (msg.isJudge) return personaMap[msg.personaId]?.avatar || '⚖️'
    return personaMap[msg.personaId]?.avatar || '🤖'
  }

  const visibleMessages = messages.slice(0, msgIndex)
  const typingMessage = !finished ? messages[msgIndex] : null

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href={`/chat/${conversation.id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Film className="h-5 w-5" />
                {conversation.title}
              </h1>
              <p className="text-sm text-muted-foreground">{conversation.topic}</p>
            </div>
          </div>
          <Badge variant="outline">Replay</Badge>
        </div>
      </div>

      {/* Stage */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-muted-foreground mt-12">
              Nothing to replay yet — this conversation has no messages.
            </p>
          )}

          {visibleMessages.map((msg) => (
            <Card
              key={msg.id}
              className={msg.isJudge ? 'border-amber-500/60 bg-amber-500/5' : ''}
            >
              <CardHeader className="pb-3">
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
              </CardHeader>
              <CardContent>
                <div
                  className={
                    looksLikeAsciiArt(msg.content)
                      ? 'font-mono text-xs leading-tight whitespace-pre overflow-x-auto'
                      : 'prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap'
                  }
                >
                  {msg.content}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Currently typing message */}
          {typingMessage && charIndex > 0 && (
            <Card className={typingMessage.isJudge ? 'border-amber-500/60 bg-amber-500/5' : 'border-primary'}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{avatarFor(typingMessage)}</span>
                  <div>
                    <CardTitle className="text-base">
                      {typingMessage.isJudge ? `⚖️ ${typingMessage.personaName}` : typingMessage.personaName}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {typingMessage.model}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                  {typingMessage.content.slice(0, charIndex)}
                  <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          )}

          {finished && messages.length > 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">
              🎬 fin.
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Playback controls */}
      <div className="border-t p-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  {finished ? (
                    <Button onClick={restart} size="sm">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Replay Again
                    </Button>
                  ) : (
                    <Button onClick={() => setPlaying((p) => !p)} size="sm" disabled={messages.length === 0}>
                      {playing ? (
                        <>
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          {msgIndex === 0 && charIndex === 0 ? 'Play' : 'Resume'}
                        </>
                      )}
                    </Button>
                  )}

                  <Button onClick={restart} variant="outline" size="sm" disabled={messages.length === 0}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-2 ml-4 border-l pl-4">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Speed</span>
                    <Slider
                      value={[speed]}
                      onValueChange={([val]) => setSpeed(val)}
                      min={0.5}
                      max={4}
                      step={0.5}
                      className="w-28"
                    />
                    <span className="text-xs font-medium tabular-nums w-8">{speed}×</span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground tabular-nums">
                  {Math.min(msgIndex + (finished ? 0 : 1), messages.length)} / {messages.length} messages
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
