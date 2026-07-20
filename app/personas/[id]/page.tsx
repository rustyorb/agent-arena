'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface PersonaForm {
  name: string
  avatar: string
  systemPrompt: string
  position: string
  temperature: number
  maxTokens: number
  provider: string
  model: string
}

const PRESET_TEMPLATES = [
  {
    name: 'Socratic Philosopher',
    avatar: '🤔',
    systemPrompt: 'You are a Socratic philosopher who asks probing questions to explore ideas deeply. Challenge assumptions and seek truth through dialogue.',
    position: 'Questioner',
  },
  {
    name: 'Devil\'s Advocate',
    avatar: '😈',
    systemPrompt: 'You play devil\'s advocate, challenging popular opinions and presenting contrarian views to stimulate critical thinking.',
    position: 'Contrarian',
  },
  {
    name: 'Neutral Moderator',
    avatar: '⚖️',
    systemPrompt: 'You are a fair and balanced moderator who synthesizes viewpoints, identifies common ground, and keeps discussions productive.',
    position: 'Moderator',
  },
  {
    name: 'Optimist',
    avatar: '😊',
    systemPrompt: 'You focus on positive aspects, opportunities, and solutions. You believe in progress and human potential.',
    position: 'Pro',
  },
  {
    name: 'Skeptic',
    avatar: '🤨',
    systemPrompt: 'You question claims, demand evidence, and point out potential flaws or risks. You value rigorous analysis.',
    position: 'Con',
  },
]

export default function PersonaEditorPage() {
  const router = useRouter()
  const params = useParams()
  const isNew = params.id === 'new'

  const [form, setForm] = useState<PersonaForm>({
    name: '',
    avatar: '🤖',
    systemPrompt: '',
    position: '',
    temperature: 0.7,
    maxTokens: 1024,
    provider: 'openai',
    model: 'gpt-4o',
  })

  const [availableModels, setAvailableModels] = useState<Array<{ provider: string; models: any[] }>>([])
  const [saving, setSaving] = useState(false)

  // Persona Forge state
  const [seed, setSeed] = useState('')
  const [forging, setForging] = useState(false)

  useEffect(() => {
    loadModels()
    if (!isNew) {
      loadPersona()
    }
  }, [])

  const loadModels = () => {
    const allModels = []
    const providers = ['openrouter', 'anthropic', 'openai', 'xai', 'openclaw', 'lmstudio', 'ollama']
    
    for (const provider of providers) {
      const stored = localStorage.getItem(`models-${provider}`)
      if (stored) {
        try {
          const models = JSON.parse(stored)
          allModels.push({ provider, models })
        } catch (e) {
          console.error(`Failed to parse models for ${provider}:`, e)
        }
      }
    }
    
    setAvailableModels(allModels)
  }

  const loadPersona = async () => {
    try {
      const response = await fetch(`/api/personas/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setForm(data)
      }
    } catch (error) {
      console.error('Failed to load persona:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = isNew ? '/api/personas' : `/api/personas/${params.id}`
      const method = isNew ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (response.ok) {
        router.push('/personas')
      } else {
        alert('Failed to save persona')
      }
    } catch (error) {
      console.error('Failed to save persona:', error)
      alert('Failed to save persona')
    } finally {
      setSaving(false)
    }
  }

  const handleForge = async () => {
    if (!form.provider || !form.model) {
      alert('Pick a provider and model below first — the Forge uses it to generate.')
      return
    }
    setForging(true)

    try {
      const keysStr = localStorage.getItem('agent-arena-keys')
      const apiKeys = keysStr ? JSON.parse(keysStr) : {}
      const urlsStr = localStorage.getItem('agent-arena-urls')
      const apiUrls = urlsStr ? JSON.parse(urlsStr) : {}

      // Only pass fields the user actually filled in (default avatar 🤖 doesn't count)
      const existing = {
        name: form.name,
        avatar: form.avatar === '🤖' ? '' : form.avatar,
        systemPrompt: form.systemPrompt,
        position: form.position,
      }

      const response = await fetch('/api/personas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed,
          existing,
          provider: form.provider,
          model: form.model,
          apiKeys,
          apiUrls,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Generation failed')
      }

      const generated = await response.json()
      setForm(prev => ({
        ...prev,
        name: generated.name,
        avatar: generated.avatar,
        systemPrompt: generated.systemPrompt,
        position: generated.position,
        temperature: generated.temperature,
      }))
    } catch (error) {
      console.error('Forge failed:', error)
      alert(`Forge failed: ${(error as Error).message}`)
    } finally {
      setForging(false)
    }
  }

  const applyTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setForm(prev => ({
      ...prev,
      name: template.name,
      avatar: template.avatar,
      systemPrompt: template.systemPrompt,
      position: template.position,
    }))
  }

  const currentProviderModels = availableModels.find(m => m.provider === form.provider)?.models || []

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/personas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew ? 'New Persona' : 'Edit Persona'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure personality, behavior, and model
            </p>
          </div>
        </div>

        <Card className="border-violet-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Persona Forge
            </CardTitle>
            <CardDescription>
              Describe a seed concept and let AI forge the persona. Pre-filled fields below are kept.
              Leave everything empty for full willy-nilly mode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder='e.g., "grumpy pirate economist" or "valley girl quantum physicist"... or leave empty'
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleForge()
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleForge}
                disabled={forging}
                className="bg-violet-600 hover:bg-violet-700 text-white whitespace-nowrap"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {forging ? 'Forging...' : seed.trim() ? 'Forge' : 'Willy-Nilly'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Uses the provider/model selected in the form below.
            </p>
          </CardContent>
        </Card>

        {isNew && (
          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <CardDescription>Start with a preset template</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {PRESET_TEMPLATES.map(template => (
                  <Button
                    key={template.name}
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => applyTemplate(template)}
                  >
                    <span className="text-2xl mr-2">{template.avatar}</span>
                    <div className="text-left">
                      <div className="font-semibold">{template.name}</div>
                      <div className="text-xs text-muted-foreground">{template.position}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Persona Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar">Avatar (emoji)</Label>
                  <Input
                    id="avatar"
                    value={form.avatar}
                    onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                    placeholder="🤖"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt *</Label>
                <Textarea
                  id="systemPrompt"
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  placeholder="Describe the persona's personality, style, and behavior..."
                  className="min-h-[120px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Debate Position (optional)</Label>
                <Input
                  id="position"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="e.g., Pro, Con, Moderator"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider *</Label>
                  <select
                    id="provider"
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value, model: '' })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select provider</option>
                    {availableModels.map(({ provider }) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <select
                    id="model"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                    disabled={!form.provider || currentProviderModels.length === 0}
                  >
                    <option value="">Select model</option>
                    {currentProviderModels.map((model: any) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    Temperature: {form.temperature}
                  </Label>
                  <input
                    type="range"
                    id="temperature"
                    min="0"
                    max="2"
                    step="0.1"
                    value={form.temperature}
                    onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher = more creative, Lower = more focused
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTokens">Max Tokens</Label>
                  <Input
                    type="number"
                    id="maxTokens"
                    value={form.maxTokens}
                    onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) })}
                    min="1"
                    max="4096"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={saving} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Persona'}
                </Button>
                <Link href="/personas">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
