import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/requireAuth.js";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_VOICES = [
  "XeomjLZoU5rr4yNIg16w", // Maya V3.1
  "1fz2mW1imKTf5Ryjk5su", // Carlos V3.1
  "zwbQ2XUiIlOKD6b3JWXd", // Aisha V3.1
  "ePEc9tlhrIO7VRkiOlQN", // James V3.1
  // Legacy V3.0 IDs (keep for existing users)
  "EXAVITQu4vr4xnSDxMaL",
  "VR6AewLTigWG4xSOukaG",
  "MF3mGyEYCl7XYWbV9V6O",
  "pNInz6obpgDQGcFmaJgB",
];

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

// POST /api/resources — AI-generated resource recommendations
router.post("/resources", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const profileStr = JSON.stringify(body.profile ?? {}).slice(0, 10000);

    // Include warmup data if available for culturally relevant recommendations
    const warmupData = body.warmup_data && typeof body.warmup_data === "object" ? body.warmup_data : null;
    const warmupContext = warmupData ? `
User's cultural touchpoints:
- Music they love: ${warmupData.music || "not shared"}
- YouTube they watch: ${warmupData.youtube || "not shared"}
- Books/shows/podcasts: ${warmupData.media || "not shared"}
Use these to make resource recommendations feel personally and culturally relevant.` : "";

    // PRIVACY: Sends user's profile and warm-up preferences to Claude for resource generation.
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
