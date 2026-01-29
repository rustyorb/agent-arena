# Agent Arena - Multi-Agent AI Conversation Orchestrator

## Overview
A web application that orchestrates autonomous multi-agent AI conversations and debates between configurable AI personas.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **UI:** React + Tailwind CSS + shadcn/ui
- **State:** Zustand (with localStorage persistence)
- **Database:** SQLite via Prisma (for conversations, personas)
- **Runtime:** Node.js

## Supported AI Providers

### Cloud Providers
| Provider | Base URL | Auth | Model Discovery |
|----------|----------|------|-----------------|
| OpenRouter | https://openrouter.ai/api/v1 | Bearer token | GET /models |
| Anthropic | https://api.anthropic.com/v1 | x-api-key header | Hardcoded list |
| OpenAI | https://api.openai.com/v1 | Bearer token | GET /models |
| X.AI (Grok) | https://api.x.ai/v1 | Bearer token | GET /models |

### Local Providers
| Provider | Base URL | Auth | Model Discovery |
|----------|----------|------|-----------------|
| LM Studio | http://localhost:6969/v1 | None | GET /models |
| Ollama | http://localhost:11434 | None | GET /api/tags |

## Core Features

### 1. API Configuration Panel (`/settings`)
- Card for each provider with:
  - API key input (masked, with show/hide toggle)
  - "Test & Fetch Models" button
  - Status indicator (unconfigured/testing/valid/invalid)
  - Model count badge when valid
- Local providers: just connection test (no key needed)
- Store keys in encrypted localStorage or DB
- Cache model lists with 24h TTL

### 2. Persona Editor (`/personas`)
- CRUD interface for personas
- Fields:
  - **Name** (required)
  - **Avatar** (emoji picker or image URL)
  - **System Prompt** (personality, style, traits)
  - **Debate Position** (optional - for structured debates)
  - **Temperature** (0-2, default 0.7)
  - **Max Tokens** (default 1024)
  - **Assigned Model** (dropdown: provider/model)
- Persona templates/presets (Socratic, Devil's Advocate, Neutral Moderator, etc.)

### 3. Conversation Composer (`/chat/new`)
- Multi-select personas to include
- Topic/prompt input field
- Conversation mode selector:
  - **Free Discussion** - natural turn-taking
  - **Structured Debate** - alternating, timed
  - **Interview** - one asks, others answer
  - **Round Robin** - strict rotation
- Optional: Max turns, auto-stop conditions

### 4. Chat Interface (`/chat/[id]`)
- Message display with:
  - Persona avatar + name
  - Model badge (e.g., "gpt-4o")
  - Timestamp
  - Message content (markdown rendered)
- Control panel:
  - ▶️ Start / ⏸️ Pause / ⏹️ Stop
  - Turn indicator (who's speaking next)
  - Speed control (delay between turns)
- Auto-scroll with "scroll to bottom" button
- Export conversation (JSON, Markdown)

### 5. Turn-Taking Logic
```typescript
interface TurnManager {
  mode: 'free' | 'debate' | 'interview' | 'round-robin';
  currentSpeaker: string; // persona id
  history: Message[];
  
  getNextSpeaker(): string;
  buildPrompt(persona: Persona): string;
  shouldContinue(): boolean;
}
```

For **free discussion**:
- Include last N messages as context
- Each persona sees: their system prompt + conversation history + "It's your turn to respond"
- Rotate through personas, skip if they say "[PASS]"

### 6. Unified Provider Interface
```typescript
interface AIProvider {
  name: string;
  baseUrl: string;
  
  validateKey(key: string): Promise<boolean>;
  fetchModels(key: string): Promise<Model[]>;
  chat(config: ChatConfig): AsyncGenerator<string>;
}
```

## Database Schema (Prisma)

```prisma
model Persona {
  id          String   @id @default(cuid())
  name        String
  avatar      String?
  systemPrompt String
  position    String?
  temperature Float    @default(0.7)
  maxTokens   Int      @default(1024)
  provider    String
  model       String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Conversation {
  id        String    @id @default(cuid())
  title     String
  topic     String
  mode      String
  personas  String    // JSON array of persona IDs
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  personaId      String
  personaName    String
  model          String
  content        String
  createdAt      DateTime     @default(now())
}

model ApiKey {
  id        String   @id @default(cuid())
  provider  String   @unique
  key       String   // encrypted
  models    String?  // cached JSON
  validatedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│  🎭 Agent Arena                    [Settings] [New] │
├─────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────────────────────┐ │
│ │ Personas    │ │ Chat Area                       │ │
│ │ ─────────── │ │                                 │ │
│ │ 🤖 Claude   │ │ 🤖 Claude (claude-3-opus)       │ │
│ │ 🧠 GPT      │ │ "I think the key insight is..." │ │
│ │ 🔮 Grok     │ │                                 │ │
│ │             │ │ 🧠 GPT (gpt-4o)                 │ │
│ │ [+ Add]     │ │ "Building on that point..."     │ │
│ │             │ │                                 │ │
│ └─────────────┘ │ 🔮 Grok (grok-2)                │ │
│                 │ "Actually, I disagree..."       │ │
│ ┌─────────────┐ │                                 │ │
│ │ History     │ ├─────────────────────────────────┤ │
│ │ ─────────── │ │ Topic: "Is AI consciousness..." │ │
│ │ > AI Ethics │ │ [▶️ Start] [⏸️] [⏹️]  Speed: ▓░░ │ │
│ │   Free Will │ └─────────────────────────────────┘ │
│ └─────────────┘                                     │
└─────────────────────────────────────────────────────┘
```

## File Structure

```
agent-arena/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (redirect to /chat)
│   ├── chat/
│   │   ├── page.tsx (conversation list)
│   │   ├── new/page.tsx (composer)
│   │   └── [id]/page.tsx (active chat)
│   ├── personas/
│   │   ├── page.tsx (list)
│   │   └── [id]/page.tsx (editor)
│   ├── settings/
│   │   └── page.tsx (API config)
│   └── api/
│       ├── chat/route.ts (streaming proxy)
│       ├── models/[provider]/route.ts
│       └── validate/[provider]/route.ts
├── components/
│   ├── ui/ (shadcn components)
│   ├── chat/
│   │   ├── MessageBubble.tsx
│   │   ├── ChatControls.tsx
│   │   └── ConversationView.tsx
│   ├── personas/
│   │   ├── PersonaCard.tsx
│   │   └── PersonaEditor.tsx
│   └── settings/
│       └── ProviderCard.tsx
├── lib/
│   ├── providers/
│   │   ├── index.ts (unified interface)
│   │   ├── openrouter.ts
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   ├── xai.ts
│   │   ├── lmstudio.ts
│   │   └── ollama.ts
│   ├── orchestrator/
│   │   ├── turn-manager.ts
│   │   └── conversation-engine.ts
│   ├── store/
│   │   ├── personas.ts
│   │   ├── conversations.ts
│   │   └── settings.ts
│   └── db.ts (prisma client)
├── prisma/
│   └── schema.prisma
├── public/
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## Implementation Priority

1. **Phase 1: Foundation**
   - Project setup (Next.js, Tailwind, shadcn)
   - Database schema + Prisma setup
   - Basic layout and navigation

2. **Phase 2: Settings & Providers**
   - Provider abstraction layer
   - API key management UI
   - Model discovery for all providers

3. **Phase 3: Personas**
   - CRUD UI for personas
   - Model assignment
   - Preset templates

4. **Phase 4: Chat Core**
   - Conversation creation
   - Turn-taking engine
   - Streaming message display

5. **Phase 5: Polish**
   - Export functionality
   - Error handling
   - Mobile responsiveness
   - Dark mode

## Commands

```bash
# Development
npm run dev

# Database
npx prisma db push
npx prisma studio

# Build
npm run build
npm start
```
