# Deployment Guide

## Quick Deploy to Vercel

The easiest way to deploy Agent Arena is using [Vercel](https://vercel.com):

1. Push your code to GitHub (already done)
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Configure:
   - Framework Preset: **Next.js**
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
5. Click **Deploy**

### Environment Variables

No environment variables are required! API keys are stored securely in browser localStorage.

### Database

SQLite database will be created automatically on first run. Note that Vercel's file system is read-only in production, so for production deployments, consider upgrading to:
- PostgreSQL (via Vercel Postgres)
- PlanetScale
- Supabase

### Post-Deployment

After deployment:
1. Visit your deployment URL
2. Go to Settings (`/settings`)
3. Configure your AI provider API keys
4. Create personas
5. Start conversations!

## Alternative Deployment Options

### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod
```

### Railway

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select repository
4. Railway auto-detects Next.js
5. Deploy

### Docker (Coming Soon)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
CMD ["npm", "start"]
```

### Self-Hosted (VPS/Cloud)

```bash
# On your server
git clone https://github.com/rustyorb/agent-arena.git
cd agent-arena
npm install
npx prisma db push
npm run build
npm start
```

Run on port 3000, or configure with `PORT` environment variable.

### Using PM2 (Process Manager)

```bash
npm install -g pm2
pm2 start npm --name "agent-arena" -- start
pm2 save
pm2 startup
```

## Database Migration

To upgrade from SQLite to PostgreSQL:

1. Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Set `DATABASE_URL` environment variable
3. Run migrations:
```bash
npx prisma migrate dev
```

## Performance Tips

- Enable caching for model lists (24h TTL)
- Use CDN for static assets
- Consider Redis for session storage
- Implement rate limiting for API routes

## Monitoring

Recommended services:
- Vercel Analytics (built-in)
- Sentry for error tracking
- LogRocket for session replay

## Backup

Important data to backup:
- `/prisma/dev.db` (if using SQLite)
- API keys (stored in user's browser)

## Security Notes

- API keys never leave the client browser
- No keys stored on server
- All provider communications are direct client→provider
- Consider implementing authentication for multi-user deployments

---

Need help? [Open an issue](https://github.com/rustyorb/agent-arena/issues)
