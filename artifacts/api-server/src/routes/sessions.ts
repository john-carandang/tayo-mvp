import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/requireAuth.js";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, maxLen).trim();
}

// POST /api/sessions — save a completed session + set last_session_ended_at
router.post("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const transcript = sanitizeText(body.transcript, 100000);
    const profileJson = body.profile_json && typeof body.profile_json === "object" ? body.profile_json : {};
    const commitments = Array.isArray(body.commitments) ? body.commitments : [];

    const { data: existing } = await supabase
      .from("sessions")
      .select("session_number")
      .eq("user_id", req.userId!)
      .order("session_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sessionNumber = (existing?.session_number ?? 0) + 1;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: req.userId!,
        session_number: sessionNumber,
        transcript,
        profile_json: profileJson,
        commitments,
      })
      .select()
      .single();

    if (error) throw error;

    // Update user_profiles: save firstName and set last_session_ended_at
    const firstName = typeof profileJson.firstName === "string" ? profileJson.firstName : null;
    const profileUpdate: Record<string, unknown> = {
      user_id: req.userId!,
      last_session_ended_at: now,
    };
    if (firstName) profileUpdate.first_name = firstName;

    await supabase
      .from("user_profiles")
      .upsert(profileUpdate, { onConflict: "user_id" });

    res.json({ session: data });
  } catch (err) {
    req.log.error({ err }, "Save session error");
    res.status(500).json({ error: "Failed to save session" });
  }
});

// GET /api/sessions/latest — most recent session
router.get("/sessions/latest", requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    res.json({ session: data });
  } catch (err) {
    req.log.error({ err }, "Get latest session error");
    res.status(500).json({ error: "Failed to load session" });
  }
});

// GET /api/sessions — all sessions (for history)
router.get("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, session_number, created_at")
      .eq("user_id", req.userId!)
      .order("session_number", { ascending: false });

    if (error) throw error;
    res.json({ sessions: data ?? [] });
  } catch (err) {
    req.log.error({ err }, "Get sessions error");
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

// POST /api/dashboard-snapshot — save dashboard snapshot + generate scorecard + narrative
router.post("/dashboard-snapshot", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const profileJson = body.profile_json && typeof body.profile_json === "object" ? body.profile_json : {};

    const profileStr = JSON.stringify(profileJson).slice(0, 20000);
    const firstName = typeof profileJson.firstName === "string" ? profileJson.firstName : "you";

    // PRIVACY: Sends user's profile JSON to Claude to generate structured scorecard.
    const scorecardRes = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Generate a personal scorecard for ${firstName} based on this life coaching profile. Return ONLY valid JSON — no markdown, no explanation.

Profile: ${profileStr}

Return this exact structure:
{
  "purpose": "2-3 sentence purpose statement grounded in their actual values and themes — specific, not generic",
  "values": ["string (3-5 evocative, personally-termed values — e.g. 'Sovereign Creativity' not just 'creativity')"],
  "strengths": ["string — format exactly as: 'Strength name — one sentence explaining how this plays out in their life, like a personal strategic asset'"],
  "challenges": ["string — framed as design problems, not failures (e.g. 'Balancing depth with pace — your instinct to think thoroughly before moving creates tension with the world's demand for speed')"],
  "focusAreas": ["string — format: 'Dimension name — one sentence on why this matters most for them right now, specific to their story'"]
}

Rules:
- Be deeply specific to this person. No generic coaching language.
- Use their own words and themes where possible.
- Strengths must follow the format: 'Name — explanation that reads like a personal strategic plan entry'
- Focus areas must explain WHY it matters now, tied to their actual story
- If data is insufficient for a section, return an empty array for that field.`
      }],
    });

    const rawScorecard = scorecardRes.content[0].type === "text" ? scorecardRes.content[0].text : "{}";
    const cleanedScorecard = rawScorecard.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    let scorecard: Record<string, unknown> = {};
    try { scorecard = JSON.parse(cleanedScorecard); } catch { scorecard = {}; }

    // PRIVACY: Sends profile JSON to Claude to generate narrative blurb.
    const narrativeRes = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Write a 5-8 sentence narrative portrait for ${firstName}'s coaching dashboard. Second person. Reference specific dimensions, events, values from this profile. Warm and specific. No generic language. No quantitative scores or numbers.

Profile: ${profileStr}

Write only the narrative. No preamble. No markdown.`
      }],
    });

    const narrativeBlurb = narrativeRes.content[0].type === "text" ? narrativeRes.content[0].text : "";

    const { data: existing } = await supabase
      .from("dashboard_snapshots")
      .select("snapshot_version")
      .eq("user_id", req.userId!)
      .order("snapshot_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = (existing?.snapshot_version ?? 0) + 1;

    const { data, error } = await supabase
      .from("dashboard_snapshots")
      .insert({
        user_id: req.userId!,
        snapshot_version: version,
        chapter_cards: profileJson.lifeEvents ?? [],
        portrait_stats: profileJson.dimensions ?? [],
        scorecard,
        narrative_blurb: narrativeBlurb,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ snapshot: data });
  } catch (err) {
    req.log.error({ err }, "Dashboard snapshot error");
    res.status(500).json({ error: "Failed to generate dashboard" });
  }
});

// GET /api/dashboard-snapshot/latest — most recent snapshot
router.get("/dashboard-snapshot/latest", requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("dashboard_snapshots")
      .select("*")
      .eq("user_id", req.userId!)
      .order("snapshot_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    res.json({ snapshot: data });
  } catch (err) {
    req.log.error({ err }, "Get snapshot error");
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// GET /api/dashboard-snapshot/:id — specific snapshot by ID
router.get("/dashboard-snapshot/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("dashboard_snapshots")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (error) throw error;
    if (!data) { res.status(404).json({ error: "Snapshot not found" }); return; }
    res.json({ snapshot: data });
  } catch (err) {
    req.log.error({ err }, "Get snapshot by ID error");
    res.status(500).json({ error: "Failed to load snapshot" });
  }
});

// GET /api/dashboard-snapshot/history — all snapshot versions
router.get("/dashboard-snapshot/history", requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("dashboard_snapshots")
      .select("id, snapshot_version, created_at")
      .eq("user_id", req.userId!)
      .order("snapshot_version", { ascending: false });

    if (error) throw error;
    res.json({ history: data ?? [] });
  } catch (err) {
    req.log.error({ err }, "Get snapshot history error");
    res.status(500).json({ error: "Failed to load history" });
  }
});

export default router;
