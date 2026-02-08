# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run db:push      # Push Prisma schema changes to SQLite
npm run db:studio    # Open Prisma Studio GUI
```

First-time setup requires `npm ci` (lock file exists) followed by `npx prisma db push`.

## Architecture

Next.js 14 App Router application that orchestrates multi-agent AI conversations. Users create AI personas, assign them models from various providers, and watch them debate/discuss topics autonomously.

### Provider Layer (`lib/providers/`)

Each file exports an object implementing the `AIProvider` interface (`types.ts`). The unified interface abstracts 6 providers (OpenRouter, Anthropic, OpenAI, X.AI, LM Studio, Ollama) behind common `validateKey()`, `fetchModels()`, and `chat()` methods. The `chat()` method is an `AsyncGenerator<string>` that yields streaming text chunks.

- Cloud providers (openrouter, anthropic, openai, xai) require API keys, use Bearer token auth (Anthropic uses `x-api-key` header instead)
- Local providers (lmstudio, ollama) need no auth. Their base URLs point to the Windows host IP (`192.168.0.177`) since this runs in WSL2. Configurable via `LMSTUDIO_URL` / `OLLAMA_URL` env vars.
- Anthropic has a hardcoded model list; other providers discover models dynamically via API.
- `index.ts` re-exports all providers as `Record<ProviderId, AIProvider>` and a `getProvider()` helper.

### Orchestrator (`lib/orchestrator/`)

- **`TurnManager`**: Determines who speaks next based on conversation mode (free/debate/interview/round-robin). Builds prompts by combining persona system prompts with the last 10 messages of history. Hard limit of 20 messages per conversation.
- **`ConversationEngine`**: Wraps TurnManager with provider integration. Executes turns as an async generator that streams chunks, then persists completed messages to the database.

### State Management

Hybrid approach — API keys stored in browser `localStorage` (key: `agent-arena-keys`), personas and conversations persisted in SQLite via Prisma. No Zustand stores are currently implemented despite being a dependency.

### API Routes (`app/api/`)

| Route | Methods | Purpose |
|---|---|---|
| `/api/chat` | POST | Streaming chat proxy — receives persona config + API key from client, streams response chunks |
| `/api/conversations` | GET, POST | List/create conversations |
| `/api/conversations/[id]` | GET, PUT, DELETE | Single conversation CRUD |
| `/api/conversations/[id]/messages` | GET, POST | Fetch messages / inject human messages |
| `/api/conversations/[id]/export` | GET | Export conversation as Markdown or JSON (?format=markdown\|json) |
| `/api/personas` | GET, POST | List/create personas |
| `/api/personas/[id]` | GET, PUT, DELETE | Single persona CRUD |
| `/api/models` | GET | Fetch available models from all providers |
| `/api/validate/[provider]` | POST | Test provider connection and count models |

### Pages (`app/`)

| Route | Description |
|---|---|
| `/` | Landing page |
| `/settings` | Provider API key configuration with test/validate UI |
| `/personas` | Persona list and management |
| `/chat` | Conversation list |
| `/chat/new` | Create conversation (select personas, topic, mode) |
| `/chat/[id]` | Active chat with streaming, auto-continue, human injection, export, and stats panel |

### Database (SQLite via Prisma)

Schema at `prisma/schema.prisma` with 4 models: `Persona`, `Conversation`, `Message`, `ApiKey`. The `Conversation.personas` field stores a JSON-stringified array of persona IDs. Messages cascade-delete with their conversation.

### UI

shadcn/ui (new-york style) with Radix primitives. Components live in `components/ui/`. Theme toggle (dark/light) via `ThemeProvider` in `lib/theme-context.tsx`, managed through `components/navbar.tsx`. Path alias `@/*` maps to project root.

### Additional Components

- `components/navbar.tsx` — Client component with navigation links + theme toggle button
- `components/chat-stats.tsx` — Conversation analytics panel (message counts, word frequency, token estimates)

## Key Patterns

- All pages under `app/chat/` and `app/settings/` are client components (`'use client'`)
- Streaming uses raw `ReadableStream` / `TextDecoder` chunked transfer with `AbortController` for cancellation
- The chat page sends API keys from localStorage to the server on each request — keys are not stored server-side
- Prisma client singleton pattern in `lib/db.ts` (cached on `globalThis` in dev to survive HMR)
- The chat API route (`/api/chat`) loads conversation history from the database for multi-turn context
- Conversation GET endpoint includes messages (`include: { messages: true }`)
- PATCH routes whitelist allowed fields to prevent mass assignment
- Use `??` (nullish coalescing) instead of `||` for numeric defaults (temperature, maxTokens) to allow explicit 0 values
