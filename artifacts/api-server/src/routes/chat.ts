import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import OpenAI from "openai";

const router: IRouter = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ─── Input sanitization helpers ────────────────────────────────────────────

/** Strip null bytes and control characters; hard-cap to maxLen characters. */
function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars (keep \t \n \r)
    .slice(0, maxLen)
    .trim();
}

/** Validate and sanitize an array of chat messages. */
function sanitizeMessages(
  raw: unknown,
  maxMessages: number,
  maxContentLen: number
): Array<{ role: string; content: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, maxMessages)
    .filter((m) => m && typeof m === "object")
    .map((m) => ({
      role: ["user", "assistant"].includes(m.role) ? m.role : "user",
      content: sanitizeText(m.content, maxContentLen),
    }))
    .filter((m) => m.content.length > 0);
}

// ─── Routes ────────────────────────────────────────────────────────────────

// POST /api/transcribe — audio file → text via Whisper
router.post("/transcribe", upload.single("audio"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    // Validate MIME type — only accept audio formats
    const allowedMimeTypes = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a"];
    const mimeType = req.file.mimetype || "";
    if (!mimeType.startsWith("audio/") && !allowedMimeTypes.includes(mimeType)) {
      res.status(400).json({ error: "Invalid file type. Audio files only." });
      return;
    }

    // PRIVACY: Sends raw audio bytes (WebM/audio format, max 25 MB) to OpenAI Whisper.
    // No user-identifying metadata is attached. Audio is not stored by this server.
    // OpenAI may retain submitted audio per their data usage policies.
    const arrayBuf = req.file.buffer.buffer.slice(
      req.file.buffer.byteOffset,
      req.file.buffer.byteOffset + req.file.buffer.byteLength
    ) as ArrayBuffer;
    const transcription = await openai.audio.transcriptions.create({
      file: new File([arrayBuf], "audio.webm", { type: mimeType || "audio/webm" }),
      model: "whisper-1",
      response_format: "text",
    });

    // When response_format is 'text', the SDK returns a plain string
    res.json({ text: transcription as unknown as string });
  } catch (err) {
    req.log.error({ err }, "Transcribe error");
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

// POST /api/speak — text → mp3 via ElevenLabs
router.post("/speak", async (req: Request, res: Response) => {
  try {
    const rawText = req.body && typeof req.body === "object" ? req.body.text : undefined;
    const text = sanitizeText(rawText, 5000);

    if (!text) {
      res.status(400).json({ error: "No text provided" });
      return;
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: "TTS service not configured" });
      return;
    }

    // PRIVACY: Sends the cleaned, AI-generated coaching text (max 5 000 chars) to ElevenLabs
    // for speech synthesis. This is Tayo's own response text — it does NOT contain raw user
    // voice transcripts. ElevenLabs may retain submitted text per their data usage policies.
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, errText }, "ElevenLabs error");
      res.status(500).json({ error: "TTS failed" });
      return;
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    req.log.error({ err }, "Speak error");
    res.status(500).json({ error: "Failed to generate speech" });
  }
});

// POST /api/chat — messages + systemPrompt → Claude response
router.post("/chat", async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    // Sanitize: max 60 messages, each message content max 10 000 chars; system prompt max 25 000 chars
    const messages = sanitizeMessages(body.messages, 60, 10000);
    const systemPrompt = sanitizeText(body.systemPrompt, 25000);

    if (messages.length === 0) {
      res.status(400).json({ error: "No messages provided" });
      return;
    }

    // PRIVACY: Sends the conversation history (user voice transcripts + Tayo responses) and the
    // system prompt (includes the user's full profile JSON: name, life dimensions, values, events)
    // to Anthropic Claude. All content originates from the user's own intake session.
    // Anthropic may retain submitted messages per their data usage policies.
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    res.json({ response: responseText });
  } catch (err) {
    req.log.error({ err }, "Chat error");
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// POST /api/extract-profile — conversation text → structured profile JSON
router.post("/extract-profile", async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    // Sanitize: full conversation transcript max 60 000 chars; name max 100 chars
    const conversationText = sanitizeText(body.conversationText, 60000);
    const firstName = sanitizeText(body.firstName, 100);

    if (!conversationText) {
      res.status(400).json({ error: "No conversation text provided" });
      return;
    }

    const nameHint = firstName ? `and ${firstName}` : "";

    // PRIVACY: Sends the complete verbatim conversation transcript (all user voice transcripts
    // and Tayo responses from the intake session) to Anthropic Claude for structured extraction.
    // This is the most sensitive call — it contains everything the user said during intake.
    // Anthropic may retain submitted messages per their data usage policies.
    const prompt = `You are an expert life coach analyst. Based on the following voice conversation transcript between Tayo (an AI life coach) ${nameHint}, extract a rich structured profile.

Conversation:
${conversationText}

Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "firstName": "string (extract the user's first name from the conversation; use 'Friend' if not mentioned)",
  "dimensions": [
    {
      "name": "string (e.g. Emotional Wellbeing, Career & Purpose, Physical Health, Relationships, Financial Security)",
      "importance": number (1-10),
      "thriving": number (1-10),
      "tier": "foundational" | "growth" | "meaning",
      "themes": ["string"],
      "notableQuote": "string (direct quote from user if available)",
      "roleDescriptor": "string (2-4 word phrase describing this dimension's role in this person's life, e.g. 'Funds your freedom', 'Anchors your identity', 'Powers your creativity')",
      "legendDescription": "string (one sentence describing the specific role this dimension plays in THIS person's life, grounded in what they shared)"
    }
  ],
  "lifeEvents": [
    {
      "label": "string (short event name)",
      "approximateYear": number,
      "chapterName": "string (evocative chapter title)",
      "actualizationLevel": number (20-95),
      "type": "peak" | "valley" | "turning_point" | "stable"
    }
  ],
  "values": ["string"],
  "purposeThemes": ["string"],
  "overallNarrative": "string (3-4 sentences synthesizing the user's current life position, written in second person)"
}

Guidelines:
- Extract 4-6 life dimensions based on what was discussed
- Assign tier based on the dimension's role in their life: foundational = basic security/health, growth = career/relationships/development, meaning = purpose/legacy/fulfillment
- Life events: infer key moments mentioned (births, moves, career changes, losses, breakthroughs). Actualization = how self-actualized/fulfilled they felt at that point (20=crisis, 50=neutral, 80=thriving, 95=peak)
- Values: 3-6 core values expressed or implied
- Purpose themes: 2-4 recurring themes about what gives them meaning
- Make the overallNarrative warm, specific, and grounded in their actual words`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const profile = JSON.parse(cleaned);
    res.json({ profile });
  } catch (err) {
    req.log.error({ err }, "Extract profile error");
    res.status(500).json({ error: "Failed to extract profile" });
  }
});

// POST /api/narrative — profile → narrative paragraph (for dashboard)
router.post("/narrative", async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
    const firstName = typeof profile.firstName === "string" ? sanitizeText(profile.firstName, 100) : "you";

    // Sanitize: limit profile serialisation to prevent oversized payloads
    const profileJson = JSON.stringify(profile).slice(0, 20000);

    // PRIVACY: Sends the user's structured profile JSON (name, life dimensions, events, values,
    // purpose themes, narrative) to Anthropic Claude to generate a dashboard narrative paragraph.
    // No raw voice transcripts are included in this call.
    const prompt = `You are Tayo, a warm and analytically precise life coach. Based on this structured profile, write a narrative paragraph of 5-8 sentences for the dashboard.

Profile: ${profileJson}

The narrative must:
- Be in second person addressing ${firstName}
- Reference specific dimensions, life events, and values from the profile
- Acknowledge the user's current position with honesty and warmth
- Close with a forward-looking framing of what the coaching journey is about to unlock
- Sound human, not like a report summary

Write only the narrative paragraph. No preamble.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const narrative =
      response.content[0].type === "text" ? response.content[0].text : "";

    res.json({ narrative });
  } catch (err) {
    req.log.error({ err }, "Narrative error");
    res.status(500).json({ error: "Failed to generate narrative" });
  }
});

// POST /api/generate-plan — profile + chat history → strategic plan
router.post("/generate-plan", async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
    const firstName = sanitizeText(body.firstName, 100) || "Friend";

    // Sanitize: max 100 coaching messages, each max 10 000 chars
    const conversationHistory = sanitizeMessages(body.conversationHistory, 100, 10000);

    // Sanitize: limit profile serialisation size
    const profileJson = JSON.stringify(profile).slice(0, 20000);

    const conversationText = conversationHistory
      .map((m) => `${m.role === "user" ? firstName : "Tayo"}: ${m.content}`)
      .join("\n\n");

    // PRIVACY: Sends the user's full profile JSON and the complete coaching conversation history
    // (all user voice transcripts from the coaching session) to Anthropic Claude for plan
    // generation. This is highly personal content shared willingly by the user.
    // Anthropic may retain submitted messages per their data usage policies.
    const prompt = `Generate a deeply personal strategic life plan for ${firstName}. Be analytically precise, warm, and specific — ground every section in this user's actual profile and conversation. Do not use generic coaching language.

Profile:
${profileJson}

${conversationText ? `Coaching conversation:\n${conversationText}` : ""}

Generate a plan with these exact sections:

My Story: Current Self & Evolution
Write 4-6 sentences as a compelling narrative of where ${firstName} is today, their arc, what has shifted, and what this moment represents.

Core Strengths & Differentiators
List 4-6 core strengths with one-line descriptions. Then 3-4 differentiating qualities that make ${firstName} distinctly themselves.

Strategic Challenges
List 3-4 key tensions framed as design problems, not failures. Each with one sentence on why it matters now.

Purpose Statement
Write 2-3 sentences articulating ${firstName}'s core "why," grounded in their own values and themes.

Core Values
List 3-5 values in order of importance. Make each label personal and evocative. One-line description per value.

Focus Areas for Growth
List 2-3 dimensions most needing attention based on the thriving/importance gap, with one sentence per area.

Format each section with its title as a header. Use plain text — no asterisks, no (a), (b) prefixes, no markdown symbols.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const plan =
      response.content[0].type === "text" ? response.content[0].text : "";

    res.json({ plan });
  } catch (err) {
    req.log.error({ err }, "Generate plan error");
    res.status(500).json({ error: "Failed to generate plan" });
  }
});

export default router;
