# Yearns — Claude Code Project Context

> Read this file first. Always. It is the single source of truth for
> architecture decisions, conventions, and build order for this project.
> When in doubt about any decision, check here before asking or assuming.

---

## What this is

Yearns is an AI-powered personalised erotic fiction platform for adult women.
It generates bespoke stories on demand, shaped by a deep user desire profile.

**Tagline:** "Your intimate erotic fantasies. In words. In context. Anytime."

**Positioning:** Tasteful, stylish, literary. Not crude. Not male-gaze.
Think: Tom Ford perfume ad aesthetic, Playfair Display typography, deep plum palette.

---

## Stack — non-negotiable choices

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router | SSR for marketing, API routes, edge runtime |
| Hosting | Vercel | Zero-config, edge network, SSE support |
| Database + Auth | Supabase | Postgres + RLS + Auth + Storage in one |
| AI (generation) | Qwen3-235B-A22B via Together.ai | Primary engine, all tiers 1-4 — see ADR-002 |
| AI (offline/corpus) | Anthropic Claude claude-sonnet-4-6 | Gold-corpus seed content authorship only, not in runtime path — see ADR-002 |
| Payments (primary) | Stripe | Subscriptions, webhooks |
| Payments (backup) | CCBill | Adult content processor — always set up in parallel |
| Age verification | Veriff | UK OSA compliant, webhook-based, GDPR safe |
| Voice (V1.1) | ElevenLabs | Post-launch — not in V1 scope |
| Email | Resend | Transactional only |
| Rate limiting | Upstash Redis via @upstash/ratelimit | Edge-compatible |
| Analytics | Plausible | Privacy-first, GDPR compliant |
| Error tracking | Sentry | Scrub PII from payloads |
| Styling | Tailwind CSS + shadcn/ui | Override heavily for brand |
| Typography | Playfair Display (Google Fonts) | All story text + brand headings |

---

## Architecture decisions

Key decisions are documented as ADRs in `/docs/` (or alongside this file):

- **ADR-002** (`adr-002-qwen-primary-engine.md`) — Qwen as primary generation
  engine, Claude offline-only. Read this before touching model-router.ts or
  anything that affects the generation path. Contains the policy boundary on
  Claude's offline gold-corpus role that must not drift.

---

## Critical constraints — read before every code change

1. **Edge runtime only** — all API routes use `export const runtime = 'edge'`.
   No Node.js-only packages in route handlers. Check edge compatibility first.

2. **Age verification is a hard gate** — every `/api/generate` call checks
   `users.age_verified = true`. This check is never bypassed, cached client-side,
   or removed for testing. Use a test user with age_verified=true in dev.

3. **Never store story content in plaintext linked to a user** — the `yearns`
   table stores metadata only. `yearn_tails` stores the last 200 words for
   continuation (Pro only). Full story text is ephemeral unless user saves.

4. **Absolute content limits are in the system prompt, not the filter** —
   the content filter is a backstop, not the primary enforcement. The prompt
   engine's `ABSOLUTE_LIMITS` block handles minors, non-consent framing, etc.
   Do not weaken these limits in either place.

5. **All DB queries are scoped to the authenticated user's ID** — no query
   ever returns another user's data. RLS enforces this at DB level too,
   but the application layer must also scope explicitly.

6. **SSE streaming on Edge** — use `ReadableStream` + `TransformStream`.
   Do NOT use Node.js `stream` or `EventEmitter`. EventSource on the client
   does not support POST — use `fetch` + `response.body.getReader()`.

7. **Claude is not in the live generation path** — `model-router.ts` routes all
   tiers to Qwen. Claude's role is offline gold-corpus authorship only (tier 1-2
   reference stories, manual process). Do not re-add Claude to the runtime path
   without re-examining ADR-002. The Anthropic SDK and API key remain in the
   project for the offline use case — do not remove them.

9. **Prompt versions are loaded from DB, not hardcoded** — the `prompt_versions`
   table controls which prompt template is active. Never hardcode prompt text
   in route handlers. Always load from `buildPrompt()` in `/lib/prompt-engine.ts`.

10. **CCBill must be set up alongside Stripe from day one** — not later.
   Adult content merchants get dropped without warning. Both processors
   must be live before launch.

---

## Project structure

```
yearns/
├── CLAUDE.md                    ← you are here
├── .env.local                   ← never commit, see .env.example
├── .env.example                 ← commit this, no real values
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_rls_policies.sql
│   │   ├── 0003_functions.sql
│   │   └── 0004_seed_prompt_versions.sql
│   └── seed/
│       └── dev_seed.sql         ← test users with age_verified=true
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             ← marketing / welcome screen
│   │   ├── (auth)/
│   │   │   ├── verify-age/
│   │   │   └── signup/
│   │   ├── (app)/               ← protected by middleware
│   │   │   ├── onboarding/
│   │   │   └── read/
│   │   └── api/
│   │       ├── generate/
│   │       │   └── route.ts     ← main SSE endpoint
│   │       ├── profile/
│   │       │   ├── route.ts     ← GET/PATCH desire profile
│   │       │   └── signal/
│   │       │       └── route.ts ← implicit signal ingestion
│   │       └── webhooks/
│   │           ├── stripe/
│   │           │   └── route.ts
│   │           └── veriff/
│   │               └── route.ts
│   │
│   ├── lib/
│   │   ├── prompt-engine.ts     ← CORE IP — see docs/prompt-engine.md
│   │   ├── content-filter.ts
│   │   ├── rate-limiter.ts
│   │   ├── generation-logger.ts
│   │   ├── supabase.ts          ← client factories (server + client)
│   │   └── stripe.ts
│   │
│   ├── hooks/
│   │   ├── useYearn.ts          ← SSE consumer + state machine
│   │   ├── useProfile.ts
│   │   └── useAuth.ts
│   │
│   └── components/
│       ├── ui/                  ← shadcn primitives, heavily overridden
│       ├── reader/
│       │   ├── StoryReader.tsx  ← main reading experience
│       │   ├── ExplicitnessDial.tsx
│       │   └── YearnControls.tsx
│       └── onboarding/
│           ├── OnboardingFlow.tsx
│           ├── steps/
│           │   ├── NameStep.tsx
│           │   ├── GenreStep.tsx
│           │   ├── FeelStep.tsx
│           │   ├── DesireStep.tsx
│           │   └── SettingStep.tsx
│           └── GeneratingScreen.tsx
│
└── docs/
    ├── prompt-engine.md         ← prompt design decisions + test cases
    ├── content-policy.md        ← what is and isn't permitted + rationale
    └── trainer-guide.md         ← for erotica quality trainers
```

---

## Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-side only, never expose

# Anthropic
ANTHROPIC_API_KEY=              # apply for adult content operator access first

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# CCBill (parallel processor — set up immediately)
CCBILL_ACCOUNT_NUMBER=
CCBILL_SUB_ACCOUNT_NUMBER=
CCBILL_DATALINK_USERNAME=
CCBILL_DATALINK_PASSWORD=

# Veriff (age verification)
VERIFF_API_KEY=
VERIFF_SECRET=

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXT_PUBLIC_APP_URL=            # https://yearns.app in prod

# Resend (email)
RESEND_API_KEY=

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

---

## Database schema overview

See `/supabase/migrations/` for full SQL. Summary:

| Table | Purpose |
|---|---|
| `users` | Auth + age_verified + subscription state |
| `desire_profiles` | Full user preference profile — the prompt engine's input |
| `subscriptions` | Stripe subscription state, synced via webhook |
| `yearns` | Metadata only — no story text. Save/bookmark records |
| `yearn_tails` | Last 200 words per user for continuation (Pro, ephemeral) |
| `generation_logs` | Analytics — status, length, explicitness, prompt_version |
| `prompt_versions` | Versioned prompt templates, A/B testable |
| `implicit_signals` | Behavioural signals for profile learning |

---

## Key files to understand before modifying anything

1. `/src/lib/prompt-engine.ts` — reads the desire profile and assembles
   the Claude system + user prompts. The ordering of sections in the system
   prompt matters. Hard limits always first.

2. `/src/app/api/generate/route.ts` — the main SSE endpoint. 13-step
   responsibility chain: parse → auth → age → subscription → rate limit →
   input filter → load profile → build prompt → open SSE → stream → output
   filter → log → update usage.

3. `/src/hooks/useYearn.ts` — the client-side state machine. Uses a 50ms
   flush interval to batch token updates (avoids per-token re-renders).
   Uses AbortController for cancellation.

4. `/supabase/migrations/0002_rls_policies.sql` — Row Level Security.
   Every table is locked to the authenticated user. Never disable RLS.

---

## Build order (V1 MVP)

Work through these in sequence. Each step depends on the previous.

- [ ] 1. Run Supabase migrations (0001 → 0004)
- [ ] 2. Seed dev database (dev_seed.sql)
- [ ] 3. Configure environment variables
- [ ] 4. Implement `/src/lib/supabase.ts` (server + client factories)
- [ ] 5. Implement `/src/lib/content-filter.ts` (V1: keyword blocklist)
- [ ] 6. Implement `/src/lib/rate-limiter.ts` (Upstash wrapper)
- [ ] 7. Implement `/src/lib/generation-logger.ts` (Supabase insert)
- [ ] 8. Wire `/src/app/api/generate/route.ts` (already written, needs lib deps)
- [ ] 9. Wire `/src/hooks/useYearn.ts` (already written, needs auth token)
- [ ] 10. Build onboarding flow (OnboardingFlow.tsx + step components)
- [ ] 11. Build story reader (StoryReader.tsx + ExplicitnessDial.tsx)
- [ ] 12. Build age gate flow (Veriff integration + webhook)
- [ ] 13. Build auth flow (Supabase Auth — magic link preferred)
- [ ] 14. Build Stripe billing (checkout + webhook + subscription gating)
- [ ] 15. Set up CCBill (parallel to Stripe — do not skip)
- [ ] 16. Add PWA manifest + service worker
- [ ] 17. Configure Sentry (scrub PII from payloads)
- [ ] 18. Configure Plausible analytics
- [ ] 19. Deploy to Vercel (set all env vars before first deploy)
- [ ] 20. Smoke test with real age-verified test user end-to-end

---

## Conventions

- **File naming:** kebab-case for files, PascalCase for React components
- **Imports:** always use `@/` alias for src/ paths
- **Types:** co-locate with the module that owns them, export from there
- **Errors:** never expose internal messages to client. Log full error
  server-side (Sentry), return opaque code to client.
- **Comments:** explain *why*, not *what*. The what is the code itself.
- **Tests:** prompt engine has unit tests. Route handler has integration tests.
  Run `pnpm test` before committing changes to either.
- **Migrations:** never edit existing migration files. Always add a new one.
  Migrations are immutable once applied.
- **Prompt changes:** increment prompt_version (semver) in prompt_versions
  table. Never modify a live version — add a new row and set is_active=true.

---

## Subscription plans

| Feature | Free | Pro ($12.99/mo or $99/yr) |
|---|---|---|
| Yearns per month | 5 | Unlimited |
| Save Yearns | — | Yes |
| Scheduled Yearns | — | Yes |
| Voice narration (V1.1) | — | Yes |
| Continue Yearns | — | Yes |
| Export ePub | — | Yes |

Free limit is enforced via `users.monthly_usage` counter.
Pro status is enforced via `subscriptions.status = 'active'`.
Both checks happen in `/api/generate` on every request.

---

## Content policy summary

Full policy in `/docs/content-policy.md`. Summary of absolute limits:

- No minors. All characters explicitly 18+. Ambiguous ages = write as 25+.
- No approving presentation of non-consent.
- No real named public figures in sexual scenarios.
- No copyrighted text reproduction.

These limits are enforced in THREE places:
1. Prompt engine system prompt (`ABSOLUTE_LIMITS` block — primary enforcement)
2. Input content filter (fast pre-generation check)
3. Output content filter (post-generation backstop)

Do not remove enforcement from any of these three places.

---

## Trainer system (added v1.1)

Quality review infrastructure for the Yearns prompt iteration and
fine-tuning pipeline. Trainers are trusted internal users who read
generated stories, score them, annotate text spans, and submit
structured feedback that feeds into prompt improvements and the
gold corpus for fine-tuning.

### New files

| File | Purpose |
|---|---|
| `src/middleware.ts` | Protects /trainer and /api/trainer routes — checks role |
| `src/types/trainer.ts` | All TypeScript types for the trainer system |
| `src/app/api/trainer/reviews/route.ts` | GET queue · POST submit · GET stats |
| `src/app/api/trainer/queue/route.ts` | Admin: populate queue from generation_logs |
| `supabase/migrations/0006_trainer_system.sql` | trainer_reviews + story_queue tables + RLS |
| `supabase/migrations/0007_prompt_stats_function.sql` | update_prompt_version_stats() + quality view |

### New tables

| Table | Purpose |
|---|---|
| `trainer_reviews` | One review per trainer per story. Scores, annotations, corpus tag. |
| `story_queue` | Controls which stories trainers see. Supports blind review. |

### New DB functions

| Function | Purpose |
|---|---|
| `get_trainer_queue(trainer_id, limit)` | Returns next stories for a trainer, prioritised |
| `get_review_stats(version, model, lang)` | Aggregate quality metrics with optional filters |
| `update_prompt_version_stats(version)` | Updates prompt_versions.avg_score after a gold review |

### New view

`prompt_quality_leaderboard` — ranks all prompt versions by avg_score.
Use in admin dashboard to compare versions and decide which to promote.

### Build order for trainer system

- [x] Run migrations 0006 and 0007
- [ ] Create Supabase Storage bucket: `trainer-stories` (private, service role only)
- [x] Update logGeneration() to return inserted ID (needed for story text upload)
- [ ] Add story text upload to generate route (see comment in queue/route.ts)
- [ ] Build /trainer page using the dashboard mockup as reference
- [ ] Build /admin/queue page to trigger queue population
- [ ] Seed trainer accounts: UPDATE users SET role='trainer' WHERE email='...'

### Critical constraint

Trainer accounts must have age_verified = true before they can access
the dashboard. The middleware enforces this. Set it manually in Supabase
dashboard for each trainer account after they complete Veriff verification.

### Blind review

story_queue.blind_review = true (default) means the trainer sees the
story text only — prompt_version and model_used are hidden until after
they submit. This prevents confirmation bias (knowing it's Llama vs Claude
before scoring). The revealed metadata appears in the session stats response
after submission.

### Corpus pipeline (manual at V1)

Gold stories (corpus_tag = 'gold') are identified automatically when
avg_score >= 4.0 AND reread = true, or set manually by the trainer.

At V1: export gold stories periodically for fine-tuning prep:
  SELECT tr.story_id, gl.prompt_version, gl.model_used, gl.language,
         tr.scores, tr.avg_score
  FROM trainer_reviews tr
  JOIN generation_logs gl ON gl.id = tr.story_id
  WHERE tr.corpus_tag = 'gold'
  ORDER BY tr.avg_score DESC;

Story text for fine-tuning is fetched from Supabase Storage:
  trainer-stories/{story_id}.txt

At V2: automate this into a Together.ai fine-tuning job trigger.

### Key design decisions (do not change without good reason)

**Blind review is the default.** Trainers must not know whether a story was
generated by Claude or Llama before scoring it — that knowledge colours
assessment. The reveal happens in session stats after submission.

**`prompt_quality_leaderboard` is the weekly decision tool.** After each
prompt iteration cycle, query it to compare avg_score and gold rate across
versions. No manual aggregation needed.

**`regen` corpus tag is a controlled test set.** Stories tagged `regen` mean
the profile config is good but the generation failed. Regenerating them with
each new prompt version gives a controlled cross-version comparison — more
rigorous than random generations.
