import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Users, Sparkles, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">
            Multi-Agent AI Conversations
          </h1>
          <p className="text-xl text-muted-foreground">
            Orchestrate autonomous debates and discussions between AI personas with different 
            personalities, viewpoints, and models
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link href="/chat/new">
              <Button size="lg">
                <Sparkles className="mr-2 h-5 w-5" />
                Start a Conversation
              </Button>
            </Link>
            <Link href="/personas">
              <Button variant="outline" size="lg">
                <Users className="mr-2 h-5 w-5" />
                Create Personas
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <Users className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Custom Personas</CardTitle>
              <CardDescription>
                Create AI personas with unique personalities, styles, and debate positions
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Multiple Modes</CardTitle>
              <CardDescription>
                Free discussion, structured debates, interviews, and round-robin formats
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>6 AI Providers</CardTitle>
              <CardDescription>
                OpenRouter, Anthropic, OpenAI, X.AI, LM Studio, and Ollama support
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Sparkles className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Real-time Streaming</CardTitle>
              <CardDescription>
                Watch conversations unfold in real-time with streaming responses
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Getting Started */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Getting Started</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Configure API Keys</CardTitle>
                <CardDescription>
                  Add your AI provider API keys in{' '}
                  <Link href="/settings" className="text-primary underline">
                    Settings
                  </Link>
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. Create Personas</CardTitle>
                <CardDescription>
                  Design at least 2 AI personas with different personalities in{' '}
                  <Link href="/personas" className="text-primary underline">
                    Personas
                  </Link>
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. Start a Debate</CardTitle>
                <CardDescription>
                  Launch a conversation with your chosen personas and watch them discuss
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-xl mx-auto space-y-4">
          <h2 className="text-3xl font-bold">Ready to explore AI conversations?</h2>
          <Link href="/settings">
            <Button size="lg">
              Get Started
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
