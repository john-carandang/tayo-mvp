# Workspace

## Overview

pnpm workspace monorepo using TypeScript. The main application is **Tayo V3.1** — a voice-first life coaching platform with Supabase auth/persistence, full onboarding flow, 3-tab dashboard, 28-minute session timer, assignment commitment capture, session lock/unlock logic, and standalone Next Moves + Profile pages.

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
│   ├── migrations/001_initial.sql     # Run first — creates core tables
│   └── migrations/002_v31.sql         # Run second — adds last_name, last_session_ended_at, coach_voice_id
├── artifacts/
│   ├── tayo/                         # Main Tayo frontend (React + Vite)
│   │   └── src/
│   │       ├── contexts/AuthContext.tsx     # Supabase auth context (Google OAuth + email/password)
│   │       ├── lib/supabase.ts              # Frontend Supabase client
│   │       ├── pages/
│   │       │   ├── Landing.tsx      # Logged-out hero + logged-in session CTA (with lock/unlock)
│   │       │   ├── SignUp.tsx       # Email/password + Google OAuth sign-up
│   │       │   ├── Login.tsx        # Email/password + Google OAuth sign-in
│   │       │   ├── FAQ.tsx          # Accordion FAQ page
│   │       │   ├── Disclosures.tsx  # 2-paragraph ICF consent (simplified)
│   │       │   ├── CoachSelect.tsx  # 4 coaches + voice preview (V3.1 voice IDs)
│   │       │   ├── Warmup.tsx       # Photos, music, YouTube, media + voice guidance on load
│   │       │   ├── Intake.tsx       # Voice intake: loads firstName from profile, coach greets by name, fixed close state machine (turn 0=ask, turn 1=commit+confirm+navigate), corrected closing message
│   │       │   ├── Dashboard.tsx    # 3-tab dashboard (Journey, Portrait, Strategic Plan) + session lock CTA; portrait colors #1B5E20/#81C784/#F9A825; narrative voice listen button; stripNumbers() on narrative
│   │       │   ├── NextMoves.tsx    # Standalone Next Moves page (assignments + resources + session banner); persists resources to localStorage tayo_resources
│   │       │   └── Profile.tsx      # Profile portal (Overview, Past Sessions, My Resources, Settings tabs); resources library with checkboxes; past sessions with snapshot expansion
│   │       ├── components/
│   │       │   ├── layout/Navbar.tsx      # Sticky navbar (logged-in/out states)
│   │       │   ├── layout/StepLayout.tsx  # Onboarding step wrapper
│   │       │   └── ui/VoiceOrb.tsx        # Voice orb (idle/speaking/listening/processing)
│   │       └── hooks/use-tayo-state.ts
│   └── api-server/                   # Express API server (port 8080)
│       └── src/
│           ├── lib/supabase.ts       # Server-side Supabase client (service role)
│           ├── middleware/requireAuth.ts  # JWT auth middleware
│           └── routes/
│               ├── chat.ts           # Whisper, ElevenLabs, Claude, extract-profile
│               ├── auth.ts           # profile GET/POST, check-in messages
│               ├── sessions.ts       # session save/load, last_session_ended_at, dashboard snapshots
│               ├── assignments.ts    # assignments CRUD + bulk, resources, coach-sample
│               └── migrate.ts        # /api/admin/health, /api/admin/migrate
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Tayo V3.1 — Application Flow

### Onboarding (auth required)
1. **Landing** (`/`) — logged-out hero / logged-in session CTA with lock/unlock state
2. **Sign Up** (`/sign-up`) — first name, last name, email/password, Google OAuth
3. **Login** (`/login`) — email/password, Google OAuth
4. **Disclosures** (`/disclosures`) — 2-paragraph simplified consent (What Tayo is + data use)
5. **Coach Selection** (`/coach`) — 4 coaches with voice previews (V3.1 ElevenLabs voice IDs)
6. **Warm-up** (`/warmup`) — photos, music, YouTube, book/show/podcast + coach voice plays on load

### Main Journey
1. **Voice Intake** (`/intake`) — 28-min graceful close timer; Session 1 vs 2+ system prompts; commitment capture phase; saves assignments to Supabase; sets `last_session_ended_at`
2. **Dashboard** (`/dashboard`) — 3 tabs:
   - **Tab A** — Journey to Date (horizontal chapter cards)
   - **Tab B** — Who You Are Now (dimension fill bars; dark green=Thriving, sage=Building, yellow=Needs Attention)
   - **Tab C** — Your Strategic Plan (scorecard: purpose, values, strengths, challenges, focus areas with listen button)
   - Session lock CTA at bottom (locked: countdown / unlocked: Begin Session N)
3. **Next Moves** (`/next-moves`) — session banner (locked/unlocked) + assignments + curated resources
4. **FAQ** (`/faq`) — accordion FAQ

### Session Lock Logic
- After each session, `last_session_ended_at` is set in `user_profiles`
- Session is locked for 7 days: `last_session_ended_at + 7 days > now()`
- Lock enforced on Landing, Dashboard, and NextMoves pages

## Design System

- **Background**: Cream `#F5F0E8`
- **Font**: Playfair Display (display/headings), system sans (body)
- **Primary**: Terracotta `#C4622D`
- **Sage**: `#7A9E87`
- **Gold**: `#D4A843`
- **Dark forest green**: `#2D6A4F` (Thriving dimension bars)
- **Brown**: `#2C1810` (dark text)
- **VoiceOrb states**: idle, speaking, listening, processing

## API Routes (api-server, port 8080)

### Public (no auth)
- `POST /api/transcribe` — audio → `{ text }` via Whisper
- `POST /api/speak` — `{ text, voiceId? }` → mp3 via ElevenLabs
- `POST /api/chat` — `{ messages, systemPrompt }` → `{ response }` via Claude
- `POST /api/extract-profile` — `{ conversationText }` → `{ profile }` via Claude
- `POST /api/coach-sample` — `{ voiceId }` → mp3 sample for coach selection
- `GET /api/health` — health check

### Authenticated (requires Bearer JWT)
- `GET/POST /api/profile` — user profile (upsert: firstName, lastName, coachId, voiceId, consent, warmupData)
- `POST /api/sessions` — save session (sets last_session_ended_at)
- `GET /api/sessions/latest` — most recent session
- `GET /api/sessions` — all session summaries (id, session_number, created_at)
- `POST /api/dashboard-snapshot` — generate scorecard + narrative via Claude
- `GET /api/dashboard-snapshot/latest` — most recent snapshot
- `GET /api/dashboard-snapshot/history` — snapshot version history
- `GET/POST /api/assignments` — assignments list + create
- `POST /api/assignments/bulk` — create multiple assignments at once (for commitment capture)
- `PATCH /api/assignments/:id` — update status + reflection
- `POST /api/resources` — AI-generated resource recommendations (profile + warmup_data context)

## Supabase Schema (5 tables)

Run `supabase/migrations/001_initial.sql` first, then `002_v31.sql` in Supabase SQL Editor.

- `user_profiles` — first_name, last_name, coach_id, coach_voice_id, warmup_data, consent_acknowledged, last_session_ended_at
- `sessions` — transcript, profile_json, session_number
- `dashboard_snapshots` — chapter_cards, portrait_stats, scorecard, narrative_blurb
- `assignments` — title, description, type, status, reflection
- `check_in_messages` — between-session messages

## Coach Voices V3.1 (ElevenLabs)

| Coach | Voice ID | Style |
|-------|----------|-------|
| Maya  | XeomjLZoU5rr4yNIg16w | Warm, direct, strength-based |
| Carlos | 1fz2mW1imKTf5Ryjk5su | Grounded, reflective, patient |
| Aisha | zwbQ2XUiIlOKD6b3JWXd | Curious, incisive, energising |
| James | ePEc9tlhrIO7VRkiOlQN | Calm, structured, encouraging |

Legacy V3.0 voice IDs are kept in allowlists for backward compat.

## Environment Variables Required

- `ANTHROPIC_API_KEY` — Claude AI
- `OPENAI_API_KEY` — Whisper transcription
- `ELEVENLABS_API_KEY` — TTS
- `SUPABASE_URL` — Supabase project URL (frontend reads via Vite define)
- `SUPABASE_ANON_KEY` — Supabase public key (frontend reads via Vite define)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin key (server-side only)

## LocalStorage Keys

- `tayo_profile` — TayoProfile JSON (cached locally for fallback)
- `tayo_coach_voice_id` — selected coach ElevenLabs voice ID
- `tayo_coach_id` — selected coach ID (maya/carlos/aisha/james)
- `tayo_warmup` — warmup data (music, youtube, media, photos)

## Vite Configuration

- `define.__SUPABASE_URL__` — injected from `process.env.SUPABASE_URL`
- `define.__SUPABASE_ANON_KEY__` — injected from `process.env.SUPABASE_ANON_KEY`
- Proxy: `/api/*` → `http://localhost:8080` (60s timeout)
