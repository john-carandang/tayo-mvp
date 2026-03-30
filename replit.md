# Workspace

## Overview

pnpm workspace monorepo using TypeScript. The main application is **Tayo** — a voice-first life coaching platform built with React + Vite + Express + Claude AI + OpenAI Whisper + ElevenLabs TTS.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (Tailwind CSS v4, framer-motion, lucide-react, recharts)
- **API framework**: Express 5
- **AI**: Anthropic Claude (claude-sonnet-4-5) for coaching + profile extraction
- **Voice Input**: OpenAI Whisper (whisper-1) via multer for audio transcription
- **Voice Output**: ElevenLabs TTS REST API (eleven_monolingual_v1) for spoken responses
- **Database**: None (localStorage only — key: `tayo_profile`)
- **Build**: esbuild (CJS bundle for api-server)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── tayo/                   # Main Tayo frontend (React + Vite)
│   │   └── src/
│   │       ├── pages/          # Intake, Dashboard, Chat, Plan
│   │       ├── components/
│   │       │   ├── layout/     # StepLayout (4-step nav)
│   │       │   └── ui/         # VoiceOrb, toaster, etc.
│   │       └── hooks/          # use-tayo-state.ts
│   └── api-server/             # Express API server
│       └── src/routes/chat.ts  # All 6 voice API endpoints
├── lib/
│   ├── api-spec/               # OpenAPI spec (legacy, no longer used for new endpoints)
│   ├── api-client-react/       # Generated React Query hooks (legacy, unused)
│   ├── api-zod/                # Generated Zod schemas (legacy, unused)
│   └── db/                     # Drizzle ORM (unused — no DB)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Tayo — Application Overview

Tayo is a **voice-first** 4-step linear life coaching flow:

1. **Step 1 — Voice Intake** (`/`): User taps the VoiceOrb, speaks through 6 guided phases (Introduction → Story → Life Areas → Values → Purpose → Final Thoughts). Claude conducts the conversation; Whisper transcribes audio; ElevenLabs speaks Claude's responses.
2. **Step 2 — Dashboard** (`/dashboard`): Three-tab visualization — Life Journey (recharts line chart of actualization over time), Wellness Pyramid (SVG 3-tier pyramid: foundational/growth/meaning from Claude), Focus Quadrant (2×2 importance vs thriving grid). Voiced narrative via small orb.
3. **Step 3 — Coaching Session** (`/chat`): Free-form voice conversation with full profile context. After 2+ user exchanges, "Build My Strategic Plan" button appears.
4. **Step 4 — Strategic Plan** (`/plan`): AI-generated personal strategic plan with formatted sections, voice narration, and "Start over" button.

## Design System

- **Background**: Cream `#F5F0E8` (HSL 37, 33%, 95%)
- **Font**: Playfair Display (display/headings), DM Sans (body)
- **Primary color**: Warm orange `#E07020`
- **Accent**: Gold `#D4A024`
- **Success/sage**: `#638863`
- **VoiceOrb states**: idle (gold/brown), speaking (orange), listening (sage green), processing (pulsing with spinner)

## API Routes (api-server, port 8080)

- `POST /api/transcribe` — audio file (multipart) → `{ text }` via Whisper
- `POST /api/speak` — `{ text }` → raw mp3 audio via ElevenLabs
- `POST /api/chat` — `{ messages, systemPrompt }` → `{ response }` via Claude
- `POST /api/extract-profile` — `{ conversationText, firstName }` → `{ profile: TayoProfile }` via Claude
- `POST /api/narrative` — `{ profile }` → `{ narrative }` via Claude
- `POST /api/generate-plan` — `{ profile, conversationHistory, firstName }` → `{ plan }` via Claude
- `GET /api/health` — health check

## Profile Schema (`tayo_profile` in localStorage)

```typescript
interface TayoProfile {
  firstName: string;
  dimensions: Array<{
    name: string;
    importance: number;    // 1-10
    thriving: number;      // 1-10
    tier: "foundational" | "growth" | "meaning";
    themes: string[];
    notableQuote: string;
  }>;
  lifeEvents: Array<{
    label: string;
    approximateYear: number;
    chapterName: string;
    actualizationLevel: number;  // 20-95
    type: "peak" | "valley" | "turning_point" | "stable";
  }>;
  values: string[];
  purposeThemes: string[];
  overallNarrative: string;
}
```

## Environment Variables Required

- `ANTHROPIC_API_KEY` — for Claude AI
- `OPENAI_API_KEY` — for Whisper transcription
- `ELEVENLABS_API_KEY` — for TTS
- `ELEVENLABS_VOICE_ID` — (optional, defaults to "EXAVITQu4vr4xnSDxMaL")

## Vite Proxy

The Tayo frontend proxies `/api/*` → `http://localhost:8080` with a 60s timeout.
