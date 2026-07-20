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

Each file exports an object implementing the `AIProvider` interface (`types.ts`). The unified interface abstracts 7 providers (OpenRouter, Anthropic, OpenAI, X.AI, OpenClaw, LM Studio, Ollama) behind common `validateKey()`, `fetchModels()`, and `chat()` methods. `chat(config, apiKey?)` takes the API key as a separate second argument (not part of `config`) and returns an `AsyncGenerator<string>` that yields streaming text chunks. Each provider declares a `requiresKey: boolean`.

- Cloud providers (openrouter, anthropic, openai, xai) require API keys, use Bearer token auth (Anthropic uses `x-api-key` header instead)
- OpenClaw (`openclaw`) requires a key and speaks the OpenAI **Responses API** (`POST /v1/responses` with `input`/`instructions` fields, `response.output_text.delta` SSE events) rather than the Chat Completions format the others use. Defaults to `http://localhost:18789`, configurable via `OPENCLAW_URL`. Single hardcoded model `openclaw:main`.
- Local providers (lmstudio, ollama) need no auth. Their base URLs point to the Windows host IP (`192.168.0.177`) since this runs in WSL2 — LM Studio on non-standard port `6969`. Configurable via `LMSTUDIO_URL` / `OLLAMA_URL` env vars. LM Studio is OpenAI-compatible (`/chat/completions`, `/models`); Ollama uses its native `/api/chat` + `/api/tags` endpoints.
- Anthropic and OpenClaw have hardcoded model lists; other providers discover models dynamically via API.
- `index.ts` re-exports all providers as `Record<ProviderId, AIProvider>` and a `getProvider()` helper.

### Orchestrator (`lib/orchestrator/`)

- **`TurnManager`**: Determines who speaks next based on conversation mode (free/debate/interview/round-robin). Builds prompts by combining persona system prompts with the last 10 messages of history. Hard limit of 20 messages per conversation.
- **`ConversationEngine`**: Wraps TurnManager with provider integration. Executes turns as an async generator that streams chunks, then persists completed messages to the database.

### State Management

Hybrid approach — API keys stored in browser `localStorage` (key: `agent-arena-keys`), personas and conversations persisted in SQLite via Prisma. No Zustand stores are currently implemented despite being a dependency.

### API Routes (`app/api/`)

| Route | Methods | Purpose |
|---|---|---|
| `/api/chat` | POST | Executes the next turn, server-orchestrated. Body: `{conversationId, apiKeys, whisper?}`. Server loads the conversation, picks the speaker via `TurnManager`, builds the prompt (injecting any whisper note into the system prompt), and streams SSE lines `data: {type: 'persona'\|'content'\|'done'\|'error', data}` |
| `/api/chat/judge` | POST | AI Judge round. Body: `{conversationId, apiKeys, final?}`. Non-streaming: judge persona scores unjudged messages (logic/persuasion/style JSON), accumulates `Conversation.scores`, stores an `isJudge` verdict message; `final: true` also declares a winner |
| `/api/personas/generate` | POST | Persona Forge. Body: `{seed?, existing?, provider, model, apiKeys}` — AI-generates persona fields from a seed, completes partially-filled forms (filled fields are kept verbatim), or invents a random persona when both are empty |
| `/api/conversations` | GET, POST | List/create conversations |
| `/api/conversations/[id]` | GET, PUT, DELETE | Single conversation CRUD |
| `/api/conversations/[id]/messages` | GET, POST | Fetch messages / inject human messages |
| `/api/conversations/[id]/export` | GET | Export conversation as Markdown or JSON (?format=markdown\|json) |
| `/api/personas` | GET, POST | List/create personas |
| `/api/personas/[id]` | GET, PUT, DELETE | Single persona CRUD |
| `/api/models` | GET | Fetch available models from all providers |
| `/api/validate/[provider]` | POST | Test provider connection. Body: `{key?, apiUrl?}` → `{valid, modelCount, models}` — the settings page caches `models` to localStorage `models-<provider>` |

### Pages (`app/`)

| Route | Description |
|---|---|
| `/` | Landing page |
| `/settings` | Provider API key configuration with test/validate UI |
| `/personas` | Persona list and management |
| `/chat` | Conversation list |
| `/chat/new` | Create conversation (select personas, topic, mode, optional AI judge) + Instant Matchups (one-click preset arenas from `lib/matchups.ts`) |
| `/chat/[id]` | Active chat with streaming, auto-continue, human injection, export, stats panel, Whisper Mode, Voice Mode toggle, live judge scoreboard, and Final Verdict |
| `/chat/[id]/replay` | Cinematic Replay — typewriter-effect playback of a finished conversation with speed control |

### Database (SQLite via Prisma)

Schema at `prisma/schema.prisma` with 4 models: `Persona`, `Conversation`, `Message`, `ApiKey`. The `Conversation.personas` field stores a JSON-stringified array of persona IDs, `Conversation.status` tracks lifecycle (`created`/`running`/`paused`/`stopped`), `Conversation.judgeId` optionally names a judge persona (never a combatant), and `Conversation.scores` holds the accumulated JSON scoreboard (`{rounds, lastJudgedCount, totals, winner?}`). `Message.isJudge` flags judge verdict messages — they're excluded from turn-taking history and the 20-message cap. Messages cascade-delete with their conversation.

### UI

shadcn/ui (new-york style) with Radix primitives. Components live in `components/ui/`. Theme toggle (dark/light) via `ThemeProvider` in `lib/theme-context.tsx`, managed through `components/navbar.tsx`. Path alias `@/*` maps to project root.

### Additional Components

- `components/navbar.tsx` — Client component with navigation links + theme toggle button
- `components/chat-stats.tsx` — Conversation analytics panel (message counts, word frequency, token estimates)
- `components/scoreboard.tsx` — Live AI Judge scoreboard strip (totals bars, round badge, winner banner)
- `lib/matchups.ts` — Instant Matchup presets (personas + topic + mode + optional judge per preset)
- `lib/voice.ts` — Voice Mode: Web Speech API TTS with a deterministic per-persona voice/pitch/rate (hash of persona ID)
- `lib/extract-json.ts` — pulls the first JSON object out of a model response (used by judge + persona-generate routes)

## Key Patterns

- All pages under `app/chat/` and `app/settings/` are client components (`'use client'`)
- Streaming uses raw `ReadableStream` / `TextDecoder` chunked transfer with `AbortController` for cancellation
- The chat page sends API keys from localStorage (key: `agent-arena-keys`) to the server on each request — keys are not stored server-side
- Per-provider base URL overrides live in localStorage `agent-arena-urls` (edited on `/settings`, persisted on successful test) and travel as `apiUrls` in chat/judge/forge/validate request bodies; `resolveProvider(id, baseUrl?)` in `lib/providers/index.ts` applies them via a shallow copy since every provider method reads `this.baseUrl`
- Custom OpenAI-compatible providers: users add `{id: "custom-<slug>", name, url}` entries on `/settings` (stored in localStorage `agent-arena-custom-providers`); `resolveProvider` treats any unknown id WITH a URL as a custom provider via `createOpenAICompatProvider()` (`lib/providers/custom.ts` — `/models` + `/chat/completions`, optional Bearer auth). The server needs no registry — id/url/key arrive per request. Removing a custom provider cleans its key, URL, and `models-<id>` cache
- Prisma client singleton pattern in `lib/db.ts` (cached on `globalThis` in dev to survive HMR)
- Turn orchestration is fully server-side: `/api/chat` loads conversation + personas, runs `TurnManager`, and streams SSE — the client only supplies `conversationId` + `apiKeys` (+ optional `whisper`)
- Whisper Mode: the client arms a `{personaId, note}` pair; the server injects it into the system prompt only when that persona is the next speaker, and the `persona` SSE event's `whispered: true` tells the client to disarm
- Judge auto-rounds are client-triggered: after each `done` event, if unjudged debate messages ≥ combatant count, the chat page calls `/api/chat/judge`
- Model dropdowns (persona editor, Instant Matchups) read cached lists from localStorage `models-<provider>` populated by the settings page
- Conversation GET endpoint includes messages (`include: { messages: true }`)
- PATCH routes whitelist allowed fields to prevent mass assignment
- Use `??` (nullish coalescing) instead of `||` for numeric defaults (temperature, maxTokens) to allow explicit 0 values
