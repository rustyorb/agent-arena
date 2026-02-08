import { ChatMessage } from '../providers/types'

export interface Message {
  id: string
  personaId: string
  personaName: string
  model: string
  content: string
  createdAt: Date
}

export interface Persona {
  id: string
  name: string
  avatar: string | null
  systemPrompt: string
  position: string | null
  temperature: number
  maxTokens: number
  provider: string
  model: string
}

export interface TurnManagerConfig {
  mode: 'free' | 'debate' | 'interview' | 'round-robin'
  topic: string
  personas: Persona[]
  history: Message[]
}

export class TurnManager {
  private mode: string
  private topic: string
  private personas: Persona[]
  private history: Message[]
  private currentIndex: number = 0

  constructor(config: TurnManagerConfig) {
    this.mode = config.mode
    this.topic = config.topic
    this.personas = config.personas
    this.history = config.history
  }

  getNextSpeaker(): Persona {
    switch (this.mode) {
      case 'round-robin':
        return this.getRoundRobinSpeaker()
      case 'debate':
        return this.getDebateSpeaker()
      case 'interview':
        return this.getInterviewSpeaker()
      case 'free':
      default:
        return this.getFreeSpeaker()
    }
  }

  buildPrompt(persona: Persona): ChatMessage[] {
    const messages: ChatMessage[] = []

    // Add system message with persona's prompt
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(persona)
    })

    // Add conversation history (last 10 messages for context)
    const recentHistory = this.history.slice(-10)
    for (const msg of recentHistory) {
      messages.push({
        role: msg.personaId === persona.id ? 'assistant' : 'user',
        content: `${msg.personaName}: ${msg.content}`
      })
    }

    // Add prompt for next turn
    if (this.history.length === 0) {
      messages.push({
        role: 'user',
        content: `You are discussing: "${this.topic}". Start the conversation with your perspective.`
      })
    } else {
      messages.push({
        role: 'user',
        content: `It's your turn to respond. Continue the discussion.`
      })
    }

    return messages
  }

  shouldContinue(): boolean {
    // Simple rule: stop after 20 messages
    return this.history.length < 20
  }

  private buildSystemPrompt(persona: Persona): string {
    let prompt = persona.systemPrompt

    if (persona.position) {
      prompt += `\n\nYour position in this debate: ${persona.position}`
    }

    prompt += '\n\nIMPORTANT: Keep your responses concise (2-3 paragraphs max). Be direct and engaging.'

    return prompt
  }

  private getRoundRobinSpeaker(): Persona {
    // Strict rotation
    const speaker = this.personas[this.currentIndex % this.personas.length]
    this.currentIndex++
    return speaker
  }

  private getDebateSpeaker(): Persona {
    // Alternate between personas with different positions
    if (this.history.length === 0) {
      return this.personas[0]
    }

    const lastSpeaker = this.history[this.history.length - 1]
    const lastPersona = this.personas.find(p => p.id === lastSpeaker.personaId)

    // Find next persona with different position (or just next one)
    const otherPersonas = this.personas.filter(p =>
      p.id !== lastPersona?.id && p.position !== lastPersona?.position
    )

    if (otherPersonas.length > 0) {
      return otherPersonas[0]
    }

    // Fallback: pick next persona in order without incrementing shared index
    const lastIndex = this.personas.findIndex(p => p.id === lastSpeaker.personaId)
    return this.personas[(lastIndex + 1) % this.personas.length]
  }

  private getInterviewSpeaker(): Persona {
    // First persona asks questions, others answer in rotation
    if (this.history.length === 0) {
      return this.personas[0] // Interviewer starts
    }

    const lastSpeaker = this.history[this.history.length - 1]

    // If interviewer just spoke, pick next interviewee
    if (lastSpeaker.personaId === this.personas[0].id) {
      const interviewees = this.personas.slice(1)
      const speaker = interviewees[this.currentIndex % interviewees.length]
      this.currentIndex++
      return speaker
    }

    // Otherwise, back to interviewer
    return this.personas[0]
  }

  private getFreeSpeaker(): Persona {
    // Smart selection: pick someone who hasn't spoken recently
    if (this.history.length === 0) {
      return this.personas[0]
    }

    // Get last 3 speakers
    const recentSpeakers = this.history.slice(-3).map(m => m.personaId)
    
    // Find personas who haven't spoken recently
    const candidates = this.personas.filter(p => !recentSpeakers.includes(p.id))
    
    if (candidates.length > 0) {
      return candidates[0]
    }

    // Fallback: pick next persona in order without incrementing shared index
    const lastSpeakerId = this.history[this.history.length - 1].personaId
    const lastIndex = this.personas.findIndex(p => p.id === lastSpeakerId)
    return this.personas[(lastIndex + 1) % this.personas.length]
  }
}
