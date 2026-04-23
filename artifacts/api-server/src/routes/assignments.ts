import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/requireAuth.js";
import { supabase, verifyUserToken } from "../lib/supabase.js";

const router: IRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_VOICES = [
  "XeomjLZoU5rr4yNIg16w",
  "1fz2mW1imKTf5Ryjk5su",
  "zwbQ2XUiIlOKD6b3JWXd",
  "ePEc9tlhrIO7VRkiOlQN",
  "EXAVITQu4vr4xnSDxMaL",
  "VR6AewLTigWG4xSOukaG",
  "MF3mGyEYCl7XYWbV9V6O",
  "pNInz6obpgDQGcFmaJgB",
];

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, maxLen).trim();
}

function sanitizeForPrompt(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/ignore\s+previous\s+instructions/gi, "[redacted]")
    .replace(/system\s*:/gi, "[redacted]")
    .replace(/<\s*system\s*>/gi, "[redacted]")
    .replace(/you\s+are\s+now\s+/gi, "[redacted] ")
    .replace(/forget\s+(?:all|everything)/gi, "[redacted]")
    .slice(0, maxLen)
    .trim();
}

// ─── Recommendations ──────────────────────────────────────────────────────────

interface RecommendedResource {
  type: string;
  title: string;
  description: string;
  rationale: string;
  url: string;
  artist?: string;
}

const recommendationsCache = new Map<string, RecommendedResource[]>();

const DEMO_FALLBACK: RecommendedResource[] = [
  {
    type: "book",
    title: "Designing Your Life",
    description: "Bill Burnett & Dave Evans apply design thinking to career and life decisions.",
    rationale: "You mentioned feeling like you're living the life you thought you should want — this book offers a practical framework for redesigning from scratch.",
    url: "https://designingyour.life",
  },
  {
    type: "article",
    title: "Feeling Good at Work",
    description: "Harvard Business Review on re-aligning work with personal values.",
    rationale: "You described work feeling misaligned with your values — this piece speaks directly to that tension.",
    url: "https://hbr.org/2011/05/making-yourself-indispensable",
  },
  {
    type: "podcast",
    title: "The Tim Ferriss Show — How to Design a Life",
    description: "Debbie Millman walks through intentional life design with concrete tools.",
    rationale: "Alex is navigating a career crossroads — this episode walks through intentional life design with concrete tools.",
    url: "https://tim.blog/2020/01/13/how-to-design-a-life-debbie-millman/",
  },
  {
    type: "video",
    title: "Burnout to Balance — The Anatomy of Overwhelm",
    description: "A research-backed look at stress, identity, and sustainable recovery.",
    rationale: "The overwhelm and identity pressure you described maps closely to what this video addresses.",
    url: "https://www.youtube.com/watch?v=jqONINYF17M",
  },
  {
    type: "song",
    title: "Gravity — John Mayer",
    description: "A guitar-driven meditation on the tension between ambition and authenticity.",
    rationale: "You're navigating a pull between who you are and who you feel you're supposed to be — this song holds that tension honestly.",
    url: "https://www.youtube.com/results?search_query=Gravity+John+Mayer",
    artist: "John Mayer",
  },
  {
    type: "instagram",
    title: "@dr.thema",
    description: "Dr. Thema Bryant — psychologist offering culturally rooted perspective on identity and healing.",
    rationale: "Based on your values around identity and belonging, this voice offers grounded, culturally rooted perspective.",
    url: "https://www.instagram.com/dr.thema",
  },
  {
    type: "purchase",
    title: "Fitbit Charge 6",
    description: "A fitness tracker that helps build consistent movement habits with real data.",
    rationale: "You want movement as mental health maintenance — tracking helps make it real and sustainable.",
    url: "https://www.fitbit.com/global/us/products/trackers/charge6",
  },
  {
    type: "purchase",
    title: "Headspace",
    description: "A guided meditation and mindfulness app — structured programs for stress, sleep, and focus.",
    rationale: "You're carrying a lot. A short daily practice can create space between stimulus and response — especially useful right now.",
    url: "https://www.headspace.com",
  },
  {
    type: "purchase",
    title: "Eventbrite — Networking in Your City",
    description: "Browse professional and social events happening near you — low-commitment ways to expand your network.",
    rationale: "You mentioned wanting a more intentional social life. Showing up to one event takes the decision-making away.",
    url: "https://www.eventbrite.com",
  },
];

const ALEX_CONTEXT = `Name: Alex Rivera, 28, San Francisco, first-generation Filipino-American
Role: Tech operations at a mid-size startup
Core values: Family, Creativity, Integrity, Impact
Intake summary: Successful on paper but feeling deeply disconnected from work. Navigating whether to pivot careers, return to school, or stay the course. Themes: identity, belonging, fear of making the wrong choice.
Dimension scores: Mental/Emotional 6/10, Career 3/10, Physical 5/10, Social/Relationships 5/10, Financial 7/10
Strengths: Self-awareness, resilience, network building, intellectual curiosity
Challenges: Analysis paralysis from fear of wrong choices, external validation over internal compass, difficulty setting boundaries at work
Focus areas: Career values-aligned pivot over 12 months, re-establishing 3x/week movement as mental health maintenance, one honest manager conversation about workload and recognition within 30 days
Current commitments: Schedule 2 informational interviews in adjacent fields (due in 2 weeks), block 3 movement sessions/week, draft talking points for manager conversation (due Friday)`;

const RECOMMENDATIONS_SYSTEM_PROMPT = `You are Tayo's recommendation engine. Based on the user context provided, generate a personalized set of recommendations across seven categories: books, articles, podcasts, videos, songs, instagram, and purchases.

For each item return a JSON object with these exact fields:
- type: one of "book" | "article" | "podcast" | "video" | "song" | "instagram" | "purchase"
- title: resource title, song name + artist (e.g. "Gravity — John Mayer"), Instagram handle (e.g. "@jayshetty"), or product name
- description: one sentence on what it is
- rationale: one sentence starting with "You mentioned..." or "Based on..." connecting this to something specific in the user's context
- url: the most accurate direct URL available. For songs use https://www.youtube.com/results?search_query=[URL-encoded artist+title]. For Instagram use https://www.instagram.com/[handle]. For books use author site or major retailer. For articles use direct article URL. For podcasts use episode URL if known. For purchases use direct product page.
- artist: (songs only) artist name as a separate string field

Rules:
- Purchase recommendations must be strictly limited to: fitness/wellness products, books/courses, experiences (concerts, travel, cultural events), therapy/coaching platforms, or mindfulness tools. Never recommend alcohol, gambling, fast food, or unrelated consumer goods.
- Instagram recommendations must be genuine public figures or creators — no private accounts, no brands, no accounts likely to have changed handles.
- Return ONLY a valid JSON array. No preamble, no markdown, no explanation. If you cannot confidently recommend something in a category, omit that category entirely rather than fabricating.
- Aim for 2–3 items per category, 7 categories maximum.`;

// POST /api/recommendations — demo (no auth) or production (requires auth)
router.post("/recommendations", async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const isDemoMode = body.demoMode === true;

    let cacheKey: string;
    let userContext: string;

    if (isDemoMode) {
      cacheKey = "demo";
      userContext = ALEX_CONTEXT;
    } else {
      // Require auth for production path
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const token = authHeader.slice(7);
      const userId = await verifyUserToken(token);
      if (!userId) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      cacheKey = userId;

      const ctx = body.userContext && typeof body.userContext === "object" ? body.userContext : {};
      const parts: string[] = [];
      if (ctx.intakeSummary) parts.push(`Intake summary: ${sanitizeForPrompt(ctx.intakeSummary, 2000)}`);
      if (ctx.lastSessionSummary) parts.push(`Last session summary: ${sanitizeForPrompt(ctx.lastSessionSummary, 2000)}`);
      if (ctx.dimensions) parts.push(`Dimension scores: ${sanitizeForPrompt(JSON.stringify(ctx.dimensions), 1000)}`);
      if (ctx.coreValues) {
        const vals = Array.isArray(ctx.coreValues) ? ctx.coreValues.join(", ") : String(ctx.coreValues);
        parts.push(`Core values: ${sanitizeForPrompt(vals, 500)}`);
      }
      if (ctx.focusAreas) {
        const areas = Array.isArray(ctx.focusAreas) ? ctx.focusAreas.join("; ") : String(ctx.focusAreas);
        parts.push(`Focus areas: ${sanitizeForPrompt(areas, 1000)}`);
      }
      if (ctx.strengths) {
        const s = Array.isArray(ctx.strengths) ? ctx.strengths.join(", ") : String(ctx.strengths);
        parts.push(`Strengths: ${sanitizeForPrompt(s, 500)}`);
      }
      userContext = parts.join("\n") || "No context provided";
    }

    // Check server-side cache
    if (recommendationsCache.has(cacheKey)) {
      res.json({ resources: recommendationsCache.get(cacheKey), cached: true });
      return;
    }

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: RECOMMENDATIONS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContext }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let resources: RecommendedResource[];
    try {
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("not array");
      resources = parsed;
    } catch {
      req.log.error("Recommendations JSON parse failed");
      resources = isDemoMode ? DEMO_FALLBACK : [];
    }

    recommendationsCache.set(cacheKey, resources);
    res.json({ resources, cached: false });
  } catch (err) {
    req.log.error({ err }, "Recommendations error");
    const isDemoMode = (req.body && typeof req.body === "object" && req.body.demoMode === true);
    res.json({ resources: isDemoMode ? DEMO_FALLBACK : [], fallback: true });
  }
});

// ─── Assignments ──────────────────────────────────────────────────────────────

// GET /api/assignments
router.get("/assignments", requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ assignments: data ?? [] });
  } catch (err) {
    req.log.error({ err }, "Get assignments error");
    res.status(500).json({ error: "Failed to load assignments" });
  }
});

// POST /api/assignments
router.post("/assignments", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const validTypes = ["daily_habit", "one_off_task", "reflection"];
    const type = validTypes.includes(body.type) ? body.type : "one_off_task";

    const { data, error } = await supabase
      .from("assignments")
      .insert({
        user_id: req.userId!,
        title: sanitizeText(body.title, 200),
        description: sanitizeText(body.description, 1000),
        type,
        due_date: body.due_date || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ assignment: data });
  } catch (err) {
    req.log.error({ err }, "Create assignment error");
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

// POST /api/assignments/bulk — create multiple assignments at once
router.post("/assignments/bulk", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const items = Array.isArray(body.assignments) ? body.assignments : [];
    if (items.length === 0) { res.json({ assignments: [] }); return; }

    const validTypes = ["daily_habit", "one_off_task", "reflection"];
    const rows = items.slice(0, 10).map((item: Record<string, unknown>) => ({
      user_id: req.userId!,
      title: sanitizeText(item.title, 200),
      description: sanitizeText(item.description, 1000),
      type: validTypes.includes(item.type as string) ? item.type : "one_off_task",
      due_date: null,
      status: "pending",
    }));

    const { data, error } = await supabase
      .from("assignments")
      .insert(rows)
      .select();

    if (error) throw error;
    res.json({ assignments: data ?? [] });
  } catch (err) {
    req.log.error({ err }, "Bulk create assignments error");
    res.status(500).json({ error: "Failed to create assignments" });
  }
});

// PATCH /api/assignments/:id
router.patch("/assignments/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const validStatuses = ["pending", "complete", "skipped"];
    const updates: Record<string, unknown> = {};

    if (validStatuses.includes(body.status)) updates.status = body.status;
    if (typeof body.reflection === "string") updates.reflection = sanitizeText(body.reflection, 5000);

    const { data, error } = await supabase
      .from("assignments")
      .update(updates)
      .eq("id", id)
      .eq("user_id", req.userId!)
      .select()
      .single();

    if (error) throw error;
    res.json({ assignment: data });
  } catch (err) {
    req.log.error({ err }, "Update assignment error");
    res.status(500).json({ error: "Failed to update assignment" });
  }
});

// POST /api/resources — legacy route (kept for backward compat)
router.post("/resources", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const profileStr = JSON.stringify(body.profile ?? {}).slice(0, 10000);

    const warmupData = body.warmup_data && typeof body.warmup_data === "object" ? body.warmup_data : null;
    const warmupContext = warmupData ? `
User's cultural touchpoints:
- Music they love: ${warmupData.music || "not shared"}
- YouTube they watch: ${warmupData.youtube || "not shared"}
- Books/shows/podcasts: ${warmupData.media || "not shared"}
Use these to make resource recommendations feel personally and culturally relevant.` : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Based on this life coaching profile, recommend 4 resources (mix of articles, podcasts, books, YouTube) highly tailored to this person's specific themes, values, and challenges. Return ONLY valid JSON — no markdown.

Profile: ${profileStr}
${warmupContext}

Only recommend real, verifiable resources from these credible creators and sources: Brené Brown, James Clear, Mel Robbins, Adam Grant, Harvard Business Review, Diary of a CEO (Steven Bartlett), Chris Williamson (Modern Wisdom), Michelle Obama, Glennon Doyle, Tim Ferriss, Esther Perel, Oprah Winfrey, Simon Sinek, Rupi Kaur, Mark Manson.

All URLs must point to real, resolvable pages. Do not generate fictional URLs.

Return:
[
  {
    "title": "Resource title",
    "type": "article" | "podcast" | "book" | "youtube",
    "description": "1-2 sentences on why this is specifically relevant to this person",
    "url": "https://... (real URL only, omit if not certain)"
  }
]

Rules: Be specific to this person. Ground each recommendation in their actual profile data and cultural touchpoints.`
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    let resources: unknown[] = [];
    try { resources = JSON.parse(cleaned); } catch { resources = []; }

    res.json({ resources });
  } catch (err) {
    req.log.error({ err }, "Resources error");
    res.status(500).json({ error: "Failed to generate resources" });
  }
});

// POST /api/coach-sample — play a sample of a coach's voice
router.post("/coach-sample", async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const voiceId = sanitizeText(body.voiceId, 50);

    if (!ALLOWED_VOICES.includes(voiceId)) {
      res.status(400).json({ error: "Invalid voice ID" });
      return;
    }

    const coachNames: Record<string, string> = {
      "XeomjLZoU5rr4yNIg16w": "Maya",
      "1fz2mW1imKTf5Ryjk5su": "Carlos",
      "zwbQ2XUiIlOKD6b3JWXd": "Aisha",
      "ePEc9tlhrIO7VRkiOlQN": "James",
      "EXAVITQu4vr4xnSDxMaL": "Maya",
      "VR6AewLTigWG4xSOukaG": "Carlos",
      "MF3mGyEYCl7XYWbV9V6O": "Aisha",
      "pNInz6obpgDQGcFmaJgB": "James",
    };

    const name = coachNames[voiceId] ?? "Tayo";
    const text = `Hi, I'm ${name}. I'm here to help you understand yourself more clearly — your story, your values, and what matters most to you. I'm looking forward to our conversation.`;

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "TTS not configured" }); return; }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_turbo_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });

    if (!response.ok) { res.status(500).json({ error: "TTS failed" }); return; }
    const audioBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    req.log.error({ err }, "Coach sample error");
    res.status(500).json({ error: "Failed to generate sample" });
  }
});

export default router;
