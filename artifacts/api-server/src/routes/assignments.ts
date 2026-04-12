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

// POST /api/resources — AI-generated resource recommendations
router.post("/resources", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const profileStr = JSON.stringify(body.profile ?? {}).slice(0, 10000);

    // PRIVACY: Sends user's profile summary to Claude to generate resource recommendations.
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Based on this life coaching profile, recommend 3-4 resources (articles, podcasts, books, YouTube channels) highly tailored to this person's specific themes, values, and challenges. Return ONLY valid JSON — no markdown.

Profile: ${profileStr}

Return:
[
  {
    "title": "Resource title",
    "type": "article" | "podcast" | "book" | "youtube",
    "description": "1-2 sentences on why this is relevant to them specifically",
    "url": "https://... (use a real URL if known, otherwise omit)"
  }
]

Rules: Be specific. No generic self-help. Ground each recommendation in their actual profile data.`
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

    const ALLOWED_VOICES = [
      "EXAVITQu4vr4xnSDxMaL", // Maya
      "VR6AewLTigWG4xSOukaG", // Carlos
      "MF3mGyEYCl7XYWbV9V6O", // Aisha
      "pNInz6obpgDQGcFmaJgB", // James
    ];

    if (!ALLOWED_VOICES.includes(voiceId)) {
      res.status(400).json({ error: "Invalid voice ID" });
      return;
    }

    const sampleTexts: Record<string, string> = {
      "EXAVITQu4vr4xnSDxMaL": "Hello, I'm Maya. I believe you already have what it takes — let's find it together.",
      "VR6AewLTigWG4xSOukaG": "Hi, I'm Carlos. I'm here to help you slow down and see what's really true for you.",
      "MF3mGyEYCl7XYWbV9V6O": "Hey, I'm Aisha. I love asking the question that opens everything up — let's get into it.",
      "pNInz6obpgDQGcFmaJgB": "Hello, I'm James. I'm here to help you build something solid, one clear step at a time.",
    };

    const text = sampleTexts[voiceId] ?? "Hello, I'm looking forward to working with you.";
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
