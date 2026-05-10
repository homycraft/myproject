# ReviewBoost — Setup Guide

## Prerequisites
- Node.js 18+
- A Neon or Railway PostgreSQL database
- Clerk account (free)
- Anthropic API key
- Vercel account (free)

---

## Step 1 — Clone and install

```bash
# Copy the project files into a new folder
cd reviewboost
npm install
```

---

## Step 2 — Database (Neon — free tier)

1. Go to https://neon.tech → New Project
2. Copy the connection string
3. Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

4. Paste your DATABASE_URL into `.env.local`
5. Push the schema:

```bash
npm run db:generate
npm run db:push
```

---

## Step 3 — Clerk Auth

1. Go to https://clerk.com → Create application
2. Enable "Email + Google" sign-in
3. Copy keys into `.env.local`:
   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   - CLERK_SECRET_KEY
4. In Clerk dashboard → Webhooks → Add endpoint:
   - URL: `https://yourdomain.com/api/clerk/webhook`
   - Events: `user.created`, `user.updated`
   - Copy the signing secret → CLERK_WEBHOOK_SECRET

---

## Step 4 — Anthropic API key

1. Go to https://console.anthropic.com → API Keys
2. Create a new key
3. Add to `.env.local` as ANTHROPIC_API_KEY

---

## Step 5 — Run locally

```bash
npm run dev
```

Visit:
- http://localhost:3000/dashboard — main dashboard
- http://localhost:3000/r/test-business — funnel preview (create a business first)

---

## Step 6 — Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add ANTHROPIC_API_KEY
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
# ... add all vars from .env.example

# Deploy to production
vercel --prod
```

Or connect GitHub repo in Vercel dashboard and add env vars in Settings → Environment Variables.

---

## Step 7 — Stripe (add when ready)

1. Go to https://stripe.com → Create account
2. Create two products:
   - Starter: ₹999/month → copy Price ID → STRIPE_STARTER_PRICE_ID
   - Pro: ₹2,499/month → copy Price ID → STRIPE_PRO_PRICE_ID
3. Add to `.env.local`
4. Set up webhook in Stripe dashboard:
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy signing secret → STRIPE_WEBHOOK_SECRET

---

## File Structure

```
reviewboost/
├── app/
│   ├── api/
│   │   ├── generate-reviews/route.ts   ← AI generation (server-only)
│   │   ├── businesses/route.ts         ← CRUD for businesses
│   │   ├── events/route.ts             ← Funnel analytics
│   │   └── stripe/webhook/route.ts     ← Stripe billing events
│   ├── r/[slug]/page.tsx               ← Public review funnel
│   ├── dashboard/page.tsx              ← Protected dashboard
│   └── layout.tsx
├── components/
│   └── funnel/
│       └── ReviewFunnel.tsx            ← Client-side funnel UI
├── lib/
│   └── db.ts                           ← Prisma singleton
├── prisma/
│   └── schema.prisma                   ← Database schema
├── middleware.ts                        ← Auth + route protection
├── .env.example                         ← All required env vars
└── package.json
```

---

## Checklist before going live

- [ ] All env vars set in Vercel
- [ ] Database pushed (`npm run db:push`)
- [ ] Clerk webhook configured
- [ ] Test funnel at /r/[your-slug] on mobile
- [ ] Verify ANTHROPIC_API_KEY is NOT in any client-side file
- [ ] Add custom domain in Vercel
- [ ] Set up Stripe webhook (can skip for free launch)
