# MimiGram — Telegram Mini App Social Media

MimiGram is a fully functional Instagram-inspired social media Mini App for Telegram. Users open the bot, tap **Buka MimiGram**, and are authenticated automatically via Telegram `initData` — no email or password.

## Features

- **Telegram Auth** — Server-side verification of `initData` (HMAC), session cookies, no email/password
- **Home Feed** — Photos & videos, infinite scroll, likes, comments, bookmarks
- **Reels** — Full-screen vertical video feed with swipe, autoplay, mute, like, follow
- **Create** — Upload photo posts, video posts, and Reels (signed upload to Supabase Storage)
- **Explore & Search** — Grid discovery + user search
- **Profile** — Edit display name & bio, posts/reels tabs, follow/unfollow
- **Notifications** — Follow, like, comment notifications
- **Telegram Bot** — `/start`, `/help`, `/profile` with Mini App button (webhook)

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | React + Vite + JavaScript           |
| Styling      | Custom CSS (mobile-first, Inter)    |
| Backend      | Vercel Serverless Functions         |
| Database     | Supabase PostgreSQL                 |
| Storage      | Supabase Storage                    |
| Auth         | Telegram WebApp `initData`          |
| Bot          | Telegram Bot API (webhook)          |
| Deploy       | Vercel                              |

## Project Structure

```
mimigram/
├── api/                    # Vercel serverless functions
│   ├── auth/               # telegram, logout, me
│   ├── posts/              # feed, create, like, comments, bookmark, upload-url
│   ├── reels/              # vertical feed
│   ├── users/              # profile, follow, search
│   ├── notifications/
│   ├── telegram/           # webhook
│   └── lib/                # telegram verify, session, supabase, http
├── src/
│   ├── components/
│   ├── pages/
│   ├── features/auth/
│   ├── services/api.js
│   └── styles/
├── supabase/migrations/    # SQL schema + RLS
├── .env.example
├── vercel.json
└── README.md
```

## Quick Start (Local)

1. **Clone & install**
   ```bash
   cd mimigram
   npm install
   ```

2. **Environment**
   ```bash
   cp .env.example .env
   # Fill BOT_TOKEN, SUPABASE_*, etc.
   ```
   Prefer Vercel CLI for full API:
   ```bash
   npx vercel dev
   ```

3. **Supabase**
   - Create a project at https://supabase.com
   - Run migrations in SQL Editor:
     - `supabase/migrations/001_initial_schema.sql`
     - `supabase/migrations/002_rls_policies.sql`
   - Create Storage bucket named **media** (public)
   - Backend uses service role for signed uploads

4. **Telegram Bot**
   - Create bot via @BotFather
   - After deploy, set Menu Button / Web App URL to your Vercel URL
   - Set webhook:
     ```bash
     curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://YOUR_APP.vercel.app/api/telegram/webhook&secret_token=YOUR_SECRET"
     ```

## Deployment (Vercel)

1. Push repo to GitHub
2. Import in Vercel
3. Set Environment Variables:

   | Variable | Secret? | Notes |
   |----------|---------|-------|
   | BOT_TOKEN | Yes | From BotFather |
   | TELEGRAM_BOT_USERNAME | No | e.g. MimiGramBot |
   | TELEGRAM_WEBHOOK_SECRET | Yes | Random string |
   | TELEGRAM_MINI_APP_URL | No | https://your-app.vercel.app |
   | SUPABASE_URL | No | Project URL |
   | SUPABASE_ANON_KEY | No | Anon key |
   | SUPABASE_SERVICE_ROLE_KEY | **Yes** | Backend only |
   | SESSION_TTL_HOURS | No | Default 168 |
   | TELEGRAM_AUTH_MAX_AGE | No | Default 86400 |

4. Deploy
5. Configure BotFather Mini App button
6. Register webhook
7. Test: open bot → Buka MimiGram → login, upload, feed, reels

## Security

- BOT_TOKEN and SUPABASE_SERVICE_ROLE_KEY never in frontend
- initData verified server-side (HMAC); initDataUnsafe never trusted
- HttpOnly session cookies (Secure in production)
- Ownership checks, rate limits, path-scoped media
- RLS as defense-in-depth

## License

MIT
