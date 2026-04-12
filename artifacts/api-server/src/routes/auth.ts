import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, maxLen).trim();
}

// GET /api/profile — load user profile row
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", req.userId!)
      .maybeSingle();

    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    req.log.error({ err }, "Get profile error");
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// POST /api/profile — upsert user profile
router.post("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const firstName = sanitizeText(body.first_name, 100);
    const lastName = sanitizeText(body.last_name, 100);
    const coachId = sanitizeText(body.coach_id, 50);
    const coachVoiceId = sanitizeText(body.coach_voice_id, 50);
    const consentAcknowledged = body.consent_acknowledged === true;
    const warmupData = body.warmup_data && typeof body.warmup_data === "object" ? body.warmup_data : undefined;

    const ALLOWED_VOICES = [
      "XeomjLZoU5rr4yNIg16w", // Maya V3.1
      "1fz2mW1imKTf5Ryjk5su", // Carlos V3.1
      "zwbQ2XUiIlOKD6b3JWXd", // Aisha V3.1
      "ePEc9tlhrIO7VRkiOlQN", // James V3.1
      // Legacy V3.0 voice IDs (keep for existing users)
      "EXAVITQu4vr4xnSDxMaL",
      "VR6AewLTigWG4xSOukaG",
      "MF3mGyEYCl7XYWbV9V6O",
      "pNInz6obpgDQGcFmaJgB",
    ];

    const upsertData: Record<string, unknown> = {
      user_id: req.userId!,
    };
    if (firstName) upsertData.first_name = firstName;
    if (lastName) upsertData.last_name = lastName;
    if (coachId) upsertData.coach_id = coachId;
    if (coachVoiceId && ALLOWED_VOICES.includes(coachVoiceId)) upsertData.coach_voice_id = coachVoiceId;
    if (consentAcknowledged) {
      upsertData.consent_acknowledged = true;
      upsertData.consent_timestamp = new Date().toISOString();
    }
    if (warmupData !== undefined) upsertData.warmup_data = warmupData;

    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(upsertData, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    req.log.error({ err }, "Upsert profile error");
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// GET /api/check-in — unread check-in messages
router.get("/check-in", requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("check_in_messages")
      .select("*")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: true });

    if (error) throw error;
    const unread = (data ?? []).filter((m: { read: boolean }) => !m.read);
    res.json({ messages: data ?? [], unreadCount: unread.length });
  } catch (err) {
    req.log.error({ err }, "Check-in messages error");
    res.status(500).json({ error: "Failed to load messages" });
  }
});

export default router;
