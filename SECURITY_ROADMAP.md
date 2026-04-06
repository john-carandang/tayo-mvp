# Tayo — Security & Privacy Roadmap

Audit conducted: April 2026  
Scope: Full codebase — `artifacts/api-server` and `artifacts/tayo`

---

## Part 1 — Issues Fixed in This Session

### 1.1 Input Sanitization Added (Server-Side)
**Risk:** All six API routes accepted raw user-supplied strings with no length limits or control-character stripping, opening the door to oversized payloads and prompt-injection attempts.  
**Fix:** Added `sanitizeText(value, maxLen)` and `sanitizeMessages(raw, maxMessages, maxContentLen)` helpers in `artifacts/api-server/src/routes/chat.ts`. Applied at every entry point before content reaches any external API:
- `/api/transcribe` — MIME-type validation (audio only)
- `/api/speak` — text capped at 5 000 characters
- `/api/chat` — max 60 messages, each content max 10 000 chars; system prompt max 25 000 chars
- `/api/extract-profile` — conversation text max 60 000 chars; firstName max 100 chars
- `/api/narrative` — profile JSON serialisation capped at 20 000 chars
- `/api/generate-plan` — max 100 messages, each max 10 000 chars; firstName max 100 chars; profile JSON capped at 20 000 chars

### 1.2 Console Logs Removed from Frontend
**Risk:** `Chat.tsx` had two `console.error(err)` calls that could expose voice transcripts, AI responses, or internal stack traces in browser developer tools.  
**Fix:** Both calls removed. All errors are already handled with user-facing generic messages (`setErrorMsg`). An additional user-facing error message was added for plan generation failures.

### 1.3 PRIVACY Comments Added to All External API Calls
**Fix:** Every external API call in `artifacts/api-server/src/routes/chat.ts` now has an inline `// PRIVACY:` comment documenting exactly what is transmitted and to which service. Summary:
- **Whisper (`/api/transcribe`):** Raw audio bytes (WebM, max 25 MB). No metadata attached.
- **ElevenLabs (`/api/speak`):** Cleaned AI-generated coaching text (Tayo's own words, not user transcripts). Max 5 000 chars.
- **Claude (`/api/chat`):** Full conversation history (user transcripts + Tayo responses) + system prompt (full profile JSON).
- **Claude (`/api/extract-profile`):** Complete verbatim intake transcript — most sensitive call.
- **Claude (`/api/narrative`):** Structured profile JSON only — no raw transcripts.
- **Claude (`/api/generate-plan`):** Full profile JSON + coaching session transcript.

### 1.4 Logger Redaction Hardened
**Fix:** Added `req.headers['xi-api-key']` to the pino redact list in `artifacts/api-server/src/lib/logger.ts` so the ElevenLabs API key is never written to server logs even if it appears in a forwarded or proxied request header.

### 1.5 API Keys Confirmed Clean
**Finding:** All three API keys (OpenAI, Anthropic, ElevenLabs) are accessed exclusively via `process.env`. No hardcoded values were found in any `.ts`, `.tsx`, `.json`, or config file. Voice ID falls back to a non-secret default string — acceptable.

### 1.6 HTTPS Verified
**Finding:** All external API calls use HTTPS:
- ElevenLabs: `https://api.elevenlabs.io/v1/text-to-speech/` ✅
- Anthropic SDK: enforces HTTPS internally ✅
- OpenAI SDK: enforces HTTPS internally ✅
- Frontend fetch calls use relative paths (`/api/...`) — same-origin, no external HTTP calls ✅

---

## Part 2 — Issues Requiring Architectural Work (Future Sessions)

### 2.1 No Authentication — Anyone with the URL Can Trigger Paid API Calls
**Risk:** HIGH — The Replit URL is publicly accessible. Any visitor can make unlimited calls to Whisper, Claude, and ElevenLabs, incurring real costs and consuming quota without restriction.  
**Required:** Implement Supabase Auth with protected routes before any real user data is stored.
- Add Supabase project and configure Auth (email/password or OAuth)
- Protect all `/api/*` routes with a server-side JWT middleware that validates the Supabase session token
- Add a login/signup gate in the React app before the Intake step loads
- Redirect unauthenticated users to a login page

### 2.2 All User Data Stored Only in Browser localStorage (No Persistence, No Encryption)
**Risk:** MEDIUM — The profile (`tayo_profile`), chat history (`tayo_chat_history`), and strategic plan (`tayo_plan`) are stored as plaintext JSON in `localStorage`. This data is:
- Lost when the tab closes or browser data is cleared
- Readable by any JavaScript running on the same origin (XSS risk)
- Not tied to a user identity
**Required:**
- Migrate to Supabase PostgreSQL: one row per user session, protected by Row Level Security (RLS)
- Encrypt sensitive fields at rest if compliance requires it

### 2.3 Supabase Row Level Security (RLS) Policies Required
When the database is connected, the following RLS policies must be in place before launch:

```sql
-- Users can only read and write their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Same pattern required for: chat_sessions, plans
```

No row should be readable or writable by any user other than its owner. RLS must be enabled on every table that stores user-generated content.

### 2.4 No Rate Limiting on API Routes
**Risk:** HIGH — Any client can send thousands of requests per minute to `/api/chat`, `/api/transcribe`, and `/api/speak`, exhausting API quota and causing cost spikes.  
**Required:**
- Add `express-rate-limit` middleware with per-IP limits (e.g., 60 requests/minute per IP across all routes; 10 requests/minute for `/api/transcribe` which is the most expensive)
- After authentication is added, add per-user rate limits in addition to per-IP

### 2.5 CORS is Fully Open
**Risk:** MEDIUM — `app.use(cors())` with no options allows any origin to send requests to the API server.  
**Required:** Restrict CORS to the Replit app domain and any custom domain once deployed:
```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "https://your-app.replit.app",
  methods: ["GET", "POST"],
}));
```

### 2.6 No HTTPS Enforcement on the Server
**Finding:** The Express server does not itself enforce HTTPS — it relies on Replit's infrastructure to do so. This is acceptable on Replit (where the proxy handles TLS), but must be verified if the app is ever moved to another host.

### 2.7 Audio Data Retention (Third-Party Policies)
**Risk:** LOW (currently) — OpenAI may retain submitted audio for up to 30 days per their data retention policy. ElevenLabs and Anthropic retain submitted text per their respective policies.  
**Recommended:** Add a privacy notice to the Intake screen before recording begins, informing users that voice data is processed by OpenAI Whisper and that coaching content is processed by Anthropic Claude and ElevenLabs.

---

## Part 3 — Dependency Vulnerabilities (Do Not Auto-Fix)

Audit run: `pnpm audit` (April 2026). **11 vulnerabilities found: 4 high, 7 moderate.**

### HIGH severity

| Package | Vulnerable versions | Patched | Path | Advisory |
|---|---|---|---|---|
| `picomatch` | <2.3.2 | >=2.3.2 | mockup-sandbox > fast-glob > micromatch | GHSA-c2c7-rcm5-vvqj — ReDoS via extglob quantifiers |
| `picomatch` | >=4.0.0 <4.0.4 | >=4.0.4 | mockup-sandbox > vite | GHSA-c2c7-rcm5-vvqj — ReDoS via extglob quantifiers |
| `path-to-regexp` | >=8.0.0 <8.4.0 | >=8.4.0 | api-server > express > router | GHSA-j3q9-mxjg-w52f — DoS via sequential optional groups |
| `lodash` | <=4.17.21 (approx) | latest | mockup-sandbox > recharts | Code injection via `_.template` |

### MODERATE severity

| Package | Vulnerable versions | Patched | Path | Advisory |
|---|---|---|---|---|
| `path-to-regexp` | >=8.0.0 <8.4.0 | >=8.4.0 | api-server > express > router | GHSA-27v5-c462-wpq7 — ReDoS via multiple wildcards |
| `@anthropic-ai/sdk` | >=0.79.0 <0.81.0 | >=0.81.0 | api-server | GHSA-5474-4w2j-mq4c — Memory Tool path validation sandbox escape |
| `lodash` | <=4.17.23 | >=4.18.0 | mockup-sandbox > recharts | GHSA-f23m-r3pf-42rh — Prototype pollution via array path bypass |
| `yaml` | <2.8.3 | >=2.8.3 | mockup-sandbox > vite | GHSA-48c2-rrv3-qjmp |

**Notes:**
- `picomatch` and `lodash` are in `mockup-sandbox` (canvas design tool), not the production Tayo app — lower immediate risk.
- `path-to-regexp` is in `express` via the `api-server` — upgrade `express` to resolve.
- `@anthropic-ai/sdk` moderate issue relates to the Memory Tool feature which Tayo does not use — risk is low in this context, but upgrading to >=0.81.0 is recommended.
- **Do not run `pnpm audit --fix` automatically** — dependency upgrades may introduce breaking changes and require testing.

### Recommended upgrade order (one at a time, with testing after each):
1. `@anthropic-ai/sdk` to >=0.81.0 in `artifacts/api-server`
2. `express` to latest in `artifacts/api-server` (resolves `path-to-regexp`)
3. `vite` to latest in `artifacts/mockup-sandbox` (resolves `picomatch`)
4. `recharts` to latest in `artifacts/tayo` (may resolve `lodash` transitively)

---

## Part 4 — Files Changed in This Session

| File | Change |
|---|---|
| `artifacts/api-server/src/routes/chat.ts` | Added input sanitization helpers + applied to all 6 routes; added `// PRIVACY:` comments to all external API calls; added audio MIME-type validation |
| `artifacts/tayo/src/pages/Chat.tsx` | Removed 2× `console.error(err)` that could expose user data; added user-facing error message for plan generation failure |
| `artifacts/api-server/src/lib/logger.ts` | Added `req.headers['xi-api-key']` to pino redact list |
| `SECURITY_ROADMAP.md` | Created (this file) |
