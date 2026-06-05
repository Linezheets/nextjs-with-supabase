# Contributing to Linezheets

## ⚠️ Deploy Rule — GitHub Only, Never `railway up`

**All code changes MUST be pushed to GitHub. Never deploy directly via Railway CLI.**

### Why?
- `railway up` bypasses GitHub, so the code is never committed
- Railway builds from the CLI snapshot, which may exclude files (like `public/`)
- If the CLI deploy fails, the code is **lost** — it was never saved anywhere
- The team cannot review, roll back, or audit CLI-only deploys

### The correct workflow

```bash
# 1. Make your changes locally
git add .
git commit -m "feat: my feature"
git push origin main        # ← This triggers Railway auto-deploy
```

Railway is connected to the `main` branch on GitHub and deploys automatically on every push.

### Deployment chain

```
GitHub (main branch)
  └─ Railway auto-deploy  →  Next.js standalone on Railway
  └─ Vercel auto-deploy   →  Next.js on Vercel (preview + production)
```

### Environment variables

| Platform  | Where to set them |
|-----------|-------------------|
| Railway   | Project → Service → Variables tab |
| Vercel    | Project → Settings → Environment Variables |
| Local dev | `.env` (copy from `.env.example`, never commit `.env`) |

### Key env vars to set on Railway

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
JWT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ANTHROPIC_API_KEY
BACKEND_URL          # Set to https://linezheets-backend-production.up.railway.app
FRONTEND_URL         # Set to https://linezheets.com (or your Vercel URL)
IPINFO_TOKEN         # ipinfo.io API token for geo-detection
```

### Key env vars to set on Vercel

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
BACKEND_URL          # Set to https://linezheets-backend-production.up.railway.app
```

### Branch strategy

- `main` — production branch. Direct commits allowed for hotfixes.
- Feature branches — create a PR for larger features before merging to main.

### Supabase migrations

Run migrations via the Supabase CLI or the Supabase dashboard SQL editor.  
Never run raw SQL directly against the database in production without testing locally first.
