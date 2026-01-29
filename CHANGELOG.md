# Changelog

## [1.0.0] - 2025-01-29

### 🎉 Initial Release

Complete multi-agent AI conversation orchestrator built with Next.js 14.

### ✨ Features

#### Phase 1: Foundation
- Next.js 14 with App Router
- TypeScript configuration
- Tailwind CSS + shadcn/ui components
- Prisma ORM with SQLite database
- Database schema for personas, conversations, messages, and API keys
- Responsive layout with navigation

#### Phase 2: Provider Layer
- Unified AI provider interface
- 6 provider implementations:
  - OpenRouter (100+ models)
  - Anthropic (Claude 3.5 Sonnet, Opus, Haiku)
  - OpenAI (GPT-4, GPT-3.5)
  - X.AI (Grok)
  - LM Studio (local)
  - Ollama (local)
- Settings page with API key management
- Model discovery and caching
- Connection testing

#### Phase 3: Personas
- Full CRUD interface for AI personas
- Persona editor with:
  - Name and avatar (emoji)
  - System prompt customization
  - Temperature and token controls
  - Model assignment from any provider
  - Optional debate positions
- 5 preset templates:
  - Socratic Philosopher
  - Devil's Advocate
  - Neutral Moderator
  - Optimist
  - Skeptic

#### Phase 4: Chat System
- Conversation creation interface
- 4 conversation modes:
  - Free Discussion (natural turn-taking)
  - Structured Debate (alternating positions)
  - Interview (Q&A format)
  - Round Robin (strict rotation)
- Turn-taking orchestrator engine
- Real-time streaming chat interface
- Message persistence
- Conversation history
- Control panel (Start/Pause/Stop)
- Auto-scroll with manual override

#### Phase 5: Polish
- Professional landing page
- Comprehensive README documentation
- TypeScript error resolution
- Production build optimization
- Mobile-responsive design
- Dark mode support (via Tailwind)
- Error handling throughout
- Loading states

### 🏗️ Technical Stack

- **Framework**: Next.js 14.2 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3
- **UI**: shadcn/ui (Radix UI primitives)
- **Database**: SQLite via Prisma 5
- **State**: Zustand + localStorage
- **Runtime**: Node.js 18+

### 📦 Build Output

- 16 routes (12 static, 4 dynamic)
- ~87KB initial bundle
- SSR-ready API routes
- Optimized for production

### 🚀 Deployment

Ready for deployment on:
- Vercel (recommended)
- Any Node.js hosting
- Docker (coming soon)

### 📝 Documentation

- Complete README with setup guide
- API provider configuration docs
- Getting started walkthrough
- Contributing guidelines

---

For detailed setup instructions, see [README.md](./README.md)
