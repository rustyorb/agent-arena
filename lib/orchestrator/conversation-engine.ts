import { TurnManager, Persona, Message } from './turn-manager'
import { getProvider } from '../providers'
import { prisma } from '../db'

export interface ConversationEngineConfig {
  conversationId: string
  mode: string
  topic: string
  personas: Persona[]
}

export class ConversationEngine {
  private conversationId: string
  private turnManager: TurnManager
  private personas: Persona[]
  private running: boolean = false

  constructor(config: ConversationEngineConfig) {
    this.conversationId = config.conversationId
    this.personas = config.personas
    this.turnManager = new TurnManager({
      mode: config.mode as any,
      topic: config.topic,
      personas: config.personas,
      history: []
    })
  }

  async *executeTurn(): AsyncGenerator<{
    persona: Persona
    content: string
    done: boolean
  }> {
    const speaker = this.turnManager.getNextSpeaker()
    const messages = this.turnManager.buildPrompt(speaker)
    
    const provider = getProvider(speaker.provider as any)
    if (!provider) {
      throw new Error(`Provider ${speaker.provider} not found`)
    }

    // Get API key from localStorage (this would be done client-side)
    const apiKey = this.getApiKey(speaker.provider)

    let fullContent = ''

    try {
      const stream = provider.chat({
        model: speaker.model,
        messages,
        temperature: speaker.temperature,
        maxTokens: speaker.maxTokens,
      }, apiKey)

      for await (const chunk of stream) {
        fullContent += chunk
        yield {
          persona: speaker,
          content: chunk,
          done: false
        }
      }

      // Save message to database
      await this.saveMessage(speaker, fullContent)

      yield {
        persona: speaker,
        content: '',
        done: true
      }
    } catch (error) {
      console.error('Error during turn:', error)
      throw error
    }
  }

  private async saveMessage(persona: Persona, content: string) {
    await prisma.message.create({
      data: {
        conversationId: this.conversationId,
        personaId: persona.id,
        personaName: persona.name,
        model: persona.model,
        content,
      }
    })
  }

  private getApiKey(provider: string): string | undefined {
    // This is a placeholder - in real implementation,
    // API keys would be retrieved from secure storage
    if (typeof window !== 'undefined') {
      const keys = localStorage.getItem('api-keys')
      if (keys) {
        const parsed = JSON.parse(keys)
        const providerKey = provider.toLowerCase().replace(/[^a-z]/g, '')
        return parsed[providerKey]
      }
    }
    return undefined
  }

  shouldContinue(): boolean {
    return this.turnManager.shouldContinue()
  }
}
