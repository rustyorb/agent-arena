# 🎭 Agent Arena

A multi-agent AI conversation orchestrator that enables autonomous debates and discussions between AI personas with different personalities, viewpoints, and models.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)

## Features

- **Multi-Provider Support**: Connect to 6 AI providers
  - OpenRouter
  - Anthropic (Claude)
  - OpenAI (GPT-4, GPT-3.5)
  - X.AI (Grok)
  - LM Studio (local)
  - Ollama (local)

- **Persona Management**: Create custom AI personas with unique:
  - Personalities and system prompts
  - Temperature and token settings
  - Model assignments
  - Debate positions

- **Conversation Modes**:
  - **Free Discussion**: Natural turn-taking
  - **Structured Debate**: Alternating positions
  - **Interview**: Q&A format
  - **Round Robin**: Strict rotation

- **Real-time Streaming**: Watch conversations unfold in real-time with streaming responses

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- At least one AI provider API key (or local Ollama/LM Studio setup)

### Installation

```bash
# Clone the repository
git clone https://github.com/rustyorb/agent-arena.git
cd agent-arena

# Install dependencies
npm install
# or
yarn install

# Initialize database
npx prisma db push

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

1. **Configure API Keys** (Settings page)
   - Navigate to `/settings`
   - Enter API keys for your chosen providers
   - Test connections to verify keys

2. **Create Personas** (`/personas`)
   - Create at least 2 personas
   - Use templates or create custom personalities
   - Assign models from configured providers

3. **Start a Conversation** (`/chat/new`)
   - Select 2+ personas
   - Choose a discussion topic
   - Pick a conversation mode
   - Watch them debate!

## Project Structure

```
agent-arena/
├── app/
│   ├── api/              # API routes
│   │   ├── chat/         # Streaming chat endpoint
│   │   ├── conversations/ # Conversation CRUD
│   │   └── personas/     # Persona CRUD
│   ├── chat/             # Chat interface pages
│   ├── personas/         # Persona management
│   ├── settings/         # Provider configuration
│   └── layout.tsx        # Root layout
├── components/
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── providers/        # AI provider implementations
│   ├── orchestrator/     # Turn-taking engine
│   └── db.ts            # Prisma client
├── prisma/
│   └── schema.prisma    # Database schema
└── public/
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Database**: SQLite via Prisma
- **State**: Zustand + localStorage

## API Providers

### Cloud Providers

| Provider | Base URL | Notes |
|----------|----------|-------|
| OpenRouter | https://openrouter.ai/api/v1 | Access to 100+ models |
| Anthropic | https://api.anthropic.com/v1 | Claude 3.5 Sonnet, Opus |
| OpenAI | https://api.openai.com/v1 | GPT-4, GPT-3.5 |
| X.AI | https://api.x.ai/v1 | Grok-2 |

### Local Providers

| Provider | Default Port | Setup |
|----------|--------------|-------|
| LM Studio | 6969 | [Download](https://lmstudio.ai) |
| Ollama | 11434 | [Install](https://ollama.ai) |

## Database Schema

- **Persona**: AI persona definitions
- **Conversation**: Multi-agent chat sessions
- **Message**: Individual chat messages
- **ApiKey**: Encrypted API credentials

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Open Prisma Studio
npm run db:studio

# Update database schema
npm run db:push
```

## Environment Variables

Create a `.env` file:

```env
# Optional: for production deployments
DATABASE_URL="file:./prisma/dev.db"
```

## Deployment

### Vercel

```bash
vercel deploy
```

### Docker

```dockerfile
# Coming soon
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Inspired by multi-agent debate systems

## Support

- 🐛 [Report a bug](https://github.com/rustyorb/agent-arena/issues)
- 💡 [Request a feature](https://github.com/rustyorb/agent-arena/issues)
- 📖 [Read the docs](https://github.com/rustyorb/agent-arena/wiki)

---

**Built for exploring AI through conversation** 🤖💬
