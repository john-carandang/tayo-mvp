# Workspace

## Overview

pnpm workspace monorepo using TypeScript. The main application is **Tayo V3** — a voice-first life coaching platform with Supabase auth/persistence, full onboarding flow, 4-tab dashboard, 30-minute session cap, and assignment tracker.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (Tailwind CSS v4, framer-motion, lucide-react, @supabase/supabase-js)
- **API framework**: Express 5 + pino logging
- **AI**: Anthropic Claude (claude-sonnet-4-5)
- **Voice Input**: OpenAI Whisper (whisper-1) via multer
- **Voice Output**: ElevenLabs TTS REST API — coach-specific voice IDs
- **Auth/Database**: Supabase (Auth + PostgreSQL with RLS)

## Structure

```text
artifacts-monorepo/
├── supabase/
│   └── migrations/001_initial.sql    # MUST run in Supabase SQL Editor first
├── artifacts/
│   ├── tayo/                         # Main Tayo frontend (React + Vite)
│   │   └── src/
│   │       ├── contexts/AuthContext.tsx     # Supabase auth context
│   │       ├── lib/supabase.ts              # Frontend Supabase client
│   │       ├── pages/
│   │       │   ├── Landing.tsx     # Hero + auth form
│   │       │   ├── Disclosures.tsx # ICF consent (6 checkboxes)
│   │       │   ├── CoachSelect.tsx # 4 coaches + voice preview
│   │       │   ├── Warmup.tsx      # Photos, music, YouTube, media
│   │       │   ├── Intake.tsx      # Voice intake (Step 1)
│   │       │   ├── Dashboard.tsx   # 4-tab dashboard (Step 2)
│   │       │   ├── Chat.tsx        # Coaching session w/ 30-min timer (Step 3)
│   │       │   └── Plan.tsx        # Redirects to /dashboard (deprecated)
│   │       ├── components/
│   │       │   ├── layout/StepLayout.tsx
│   │       │   └── ui/VoiceOrb.tsx
│   │       └── hooks/use-tayo-state.ts
│   └── api-server/                   # Express API server (port 8080)
│       └── src/
│           ├── lib/supabase.ts       # Server-side Supabase client (service role)
│           ├── middleware/requireAuth.ts  # JWT auth middleware
│           └── routes/
│               ├── chat.ts           # Whisper, ElevenLabs, Claude, extract-profile
│               ├── auth.ts           # profile GET/POST, check-in messages
│               ├── sessions.ts       # session save/load, dashboard snapshots
│               ├── assignments.ts    # assignments CRUD, resources, coach-sample
│               └── migrate.ts        # /api/admin/health, /api/admin/migrate
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Tayo V3 — Application Flow

### Onboarding (pre-steps, auth required)
1. **Landing** (`/`) — hero, 4-step map, auth form (email + password)
2. **Disclosures** (`/disclosures`) — 6 ICF checkboxes, saved to Supabase
3. **Coach Selection** (`/coach`) — 4 coaches, voice preview via ElevenLabs
4. **Warm-up** (`/warmup`) — photos, music, YouTube, book/show/podcast

### Main Journey
1. **Voice Intake** (`/intake`) — 15-20 min voice conversation, extracts TayoProfile, saves to Supabase sessions + generates dashboard snapshot
2. **Dashboard** (`/dashboard`) — 4 tabs:
   - **Tab A** — Journey to Date (horizontal chapter cards)
   - **Tab B** — Who You Are Now (dimension fill bars)
   - **Tab C** — Your Strategic Plan (scorecard: purpose, values, strengths, challenges, focus areas)
   - **Tab D** — Your Next Moves (assignments + resources)
3. **Coaching Session** (`/chat`) — 30-min timer (graceful close at 28 min), coaching rules, Supabase session save
4. **Plan** (`/plan`) — redirects to `/dashboard` (deprecated)

## Design System

- **Background**: Cream `#F5F0E8`
- **Font**: Playfair Display (display/headings), system sans (body)
- **Primary**: Terracotta `#C4622D`
- **Sage**: `#7A9E87`
- **Gold**: `#D4A843`
- **Brown**: `#2C1810` (dark text)
- **VoiceOrb states**: idle, speaking, listening, processing

## API Routes (api-server, port 8080)

### Public (no auth)
- `POST /api/transcribe` — audio → `{ text }` via Whisper
- `POST /api/speak` — `{ text, voiceId? }` → mp3 via ElevenLabs (coach-specific voice)
- `POST /api/chat` — `{ messages, systemPrompt }` → `{ response }` via Claude
- `POST /api/extract-profile` — `{ conversationText }` → `{ profile }` via Claude
- `POST /api/coach-sample` — `{ voiceId }` → mp3 sample for coach selection
- `GET /api/health` — health check
- `GET /api/admin/health` — checks if Supabase tables are set up

### Authenticated (requires Bearer JWT)
- `GET/POST /api/profile` — user profile (upsert with consent, coach, warmup)
- `GET /api/check-in` — unread check-in messages
- `POST /api/sessions` — save coaching session
- `GET /api/sessions/latest` — most recent session
- `GET /api/sessions` — all session history
- `POST /api/dashboard-snapshot` — generate scorecard + narrative via Claude, save to Supabase
- `GET /api/dashboard-snapshot/latest` — most recent snapshot
- `GET /api/dashboard-snapshot/history` — snapshot version history
- `GET/POST /api/assignments` — assignments list + create
- `PATCH /api/assignments/:id` — update status + reflection
- `POST /api/resources` — AI-generated resource recommendations

## Supabase Schema (5 tables)

Run `supabase/migrations/001_initial.sql` in Supabase SQL Editor before using.

- `user_profiles` — coach_id, warmup_data, consent_acknowledged
- `sessions` — transcript, profile_json, commitments
- `dashboard_snapshots` — chapter_cards, portrait_stats, scorecard, narrative_blurb
- `assignments` — title, description, type, status, reflection, resources
- `check_in_messages` — between-session messages

## Coach Voices (ElevenLabs)

| Coach | Voice ID | Style |
|-------|----------|-------|
| Maya  | EXAVITQu4vr4xnSDxMaL | Warm, direct, strength-based |
| Carlos | VR6AewLTigWG4xSOukaG | Grounded, reflective, patient |
| Aisha | MF3mGyEYCl7XYWbV9V6O | Curious, incisive, energising |
| James | pNInz6obpgDQGcFmaJgB | Calm, structured, encouraging |

## Environment Variables Required

- `ANTHROPIC_API_KEY` — Claude AI
- `OPENAI_API_KEY` — Whisper transcription
- `ELEVENLABS_API_KEY` — TTS
- `SUPABASE_URL` — Supabase project URL (frontend reads via Vite define)
- `SUPABASE_ANON_KEY` — Supabase public key (frontend reads via Vite define)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin key (server-side only)
- `SUPABASE_DB_URL` — (optional) Supabase direct DB URL for auto-migration

## LocalStorage Keys

- `tayo_profile` — TayoProfile JSON (cached locally for fallback)
- `tayo_chat_history` — current session chat history
- `tayo_coach_voice_id` — selected coach ElevenLabs voice ID
- `tayo_coach_id` — selected coach ID (maya/carlos/aisha/james)
- `tayo_warmup` — warmup data (music, youtube, media, photos)

## Vite Configuration

- `define.__SUPABASE_URL__` — injected from `process.env.SUPABASE_URL`
- `define.__SUPABASE_ANON_KEY__` — injected from `process.env.SUPABASE_ANON_KEY`
- Proxy: `/api/*` → `http://localhost:8080` (60s timeout)
