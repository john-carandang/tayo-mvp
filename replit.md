# Workspace

## Overview

pnpm workspace monorepo using TypeScript. The main application is **Tayo** — a whole-person life coaching and insights platform built with React + Vite + Express + Claude AI.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (Tailwind CSS, framer-motion, lucide-react)
- **API framework**: Express 5
- **AI**: Anthropic Claude (claude-sonnet-4-5) via api-server backend proxy
- **Database**: None (localStorage only)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── tayo/                   # Main Tayo frontend (React + Vite)
│   └── api-server/             # Express API server (Claude proxy)
├── lib/
│   ├── api-spec/               # OpenAPI spec + Orval codegen config
│   ├── api-client-react/       # Generated React Query hooks
│   ├── api-zod/                # Generated Zod schemas from OpenAPI
│   └── db/                     # Drizzle ORM schema + DB connection
├── scripts/                    # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Tayo — Application Overview

Tayo is a 5-step linear life coaching flow:

1. **Step 1 — Intake**: User enters name + scores 5 life dimensions (Mental & Emotional, Career, Physical, Social & Relationships, Financial) on thriving/importance Likert scales plus open-text
2. **Step 2 — Dashboard**: Three-tab visualization (Pentagon Web, Life Progress bars, Focus Quadrant) + AI narrative
3. **Step 3 — Coaching Chat**: AI conversation via Claude (system-prompted with user's data)
4. **Step 4 — Strategic Plan**: AI-generated 6-section personal strategic plan
5. **Step 5 — Habits & Goals**: 3-5 concrete, value-aligned habits and goals

## API Routes

All Claude calls go through `/api` (never directly from frontend):

- `POST /api/chat` — general coaching chat
- `POST /api/generate-narrative` — dashboard narrative paragraph
- `POST /api/generate-plan` — personal strategic plan
- `POST /api/generate-habits` — habits and goals

## Design

- Black background (`#0a0a0a`), lime green accent (`#b8f566`)
- Bold cinematic premium aesthetic
- Mobile-first responsive
- No auth, no database — localStorage only

## Environment Variables

- `ANTHROPIC_API_KEY` — required secret for Claude API

## Key Commands

- `pnpm --filter @workspace/tayo run dev` — run frontend
- `pnpm --filter @workspace/api-server run dev` — run API server
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API types
