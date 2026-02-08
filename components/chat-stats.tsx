"use client"

import { useMemo } from "react"
import { BarChart3, MessageSquare, Type, Clock, Hash } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ChatStatsProps {
  messages: Array<{
    id: string
    personaId: string
    personaName: string
    model: string
    content: string
    createdAt: string
  }>
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "and", "but", "or",
  "nor", "not", "so", "yet", "both", "either", "neither", "each",
  "every", "all", "any", "few", "more", "most", "other", "some", "such",
  "no", "only", "own", "same", "than", "too", "very", "just", "because",
  "about", "that", "this", "these", "those", "it", "its", "i", "me",
  "my", "we", "our", "you", "your", "he", "him", "his", "she", "her",
  "they", "them", "their", "what", "which", "who", "whom", "how", "when",
  "where", "why",
])

const PERSONA_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
]

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m ${seconds}s`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function getWords(content: string): string[] {
  return content.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)
}

export function ChatStats({ messages }: ChatStatsProps) {
  const stats = useMemo(() => {
    if (messages.length === 0) return null

    const totalMessages = messages.length
    const allWords = messages.flatMap((m) => getWords(m.content))
    const totalWords = allWords.length
    const estTokens = Math.round(totalWords * 1.3)

    const timestamps = messages.map((m) => new Date(m.createdAt).getTime())
    const duration = Math.max(...timestamps) - Math.min(...timestamps)

    // Messages per persona
    const personaMessageCounts = new Map<string, { name: string; count: number }>()
    for (const msg of messages) {
      const existing = personaMessageCounts.get(msg.personaId)
      if (existing) {
        existing.count++
      } else {
        personaMessageCounts.set(msg.personaId, { name: msg.personaName, count: 1 })
      }
    }
    const maxMessageCount = Math.max(...Array.from(personaMessageCounts.values()).map((p) => p.count))

    // Average message length per persona
    const personaWordCounts = new Map<string, { name: string; totalWords: number; count: number }>()
    for (const msg of messages) {
      const wordCount = getWords(msg.content).length
      const existing = personaWordCounts.get(msg.personaId)
      if (existing) {
        existing.totalWords += wordCount
        existing.count++
      } else {
        personaWordCounts.set(msg.personaId, { name: msg.personaName, totalWords: wordCount, count: 1 })
      }
    }

    // Top words
    const wordFreq = new Map<string, number>()
    for (const word of allWords) {
      if (word.length > 1 && !STOP_WORDS.has(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
      }
    }
    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    return {
      totalMessages,
      totalWords,
      estTokens,
      duration,
      personaMessageCounts: Array.from(personaMessageCounts.entries()),
      maxMessageCount,
      personaWordCounts: Array.from(personaWordCounts.entries()),
      topWords,
    }
  }, [messages])

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            Conversation Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        </CardContent>
      </Card>
    )
  }

  const maxFreq = stats.topWords.length > 0 ? stats.topWords[0][1] : 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-4 w-4" />
          Conversation Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Messages</p>
              <p className="text-sm font-medium">{formatNumber(stats.totalMessages)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Words</p>
              <p className="text-sm font-medium">{formatNumber(stats.totalWords)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Est. Tokens</p>
              <p className="text-sm font-medium">{formatNumber(stats.estTokens)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium">{formatDuration(stats.duration)}</p>
            </div>
          </div>
        </div>

        {/* Messages per Persona */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Messages per Persona</h4>
          <div className="space-y-2">
            {stats.personaMessageCounts.map(([personaId, { name, count }], idx) => (
              <div key={personaId}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{name}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${PERSONA_COLORS[idx % PERSONA_COLORS.length]}`}
                    style={{ width: `${(count / stats.maxMessageCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Average Message Length */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Avg. Message Length</h4>
          <div className="space-y-1">
            {stats.personaWordCounts.map(([personaId, { name, totalWords, count }]) => (
              <div key={personaId} className="flex justify-between text-xs">
                <span>{name}</span>
                <span className="text-muted-foreground">{Math.round(totalWords / count)} words</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Words */}
        {stats.topWords.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Top Words</h4>
            <div className="flex flex-wrap gap-2">
              {stats.topWords.map(([word, freq]) => {
                const ratio = freq / maxFreq
                let sizeClass = "text-xs"
                if (ratio > 0.8) sizeClass = "text-2xl"
                else if (ratio > 0.6) sizeClass = "text-xl"
                else if (ratio > 0.4) sizeClass = "text-lg"
                else if (ratio > 0.2) sizeClass = "text-sm"

                return (
                  <Badge key={word} variant="secondary" className={sizeClass}>
                    {word}
                  </Badge>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
