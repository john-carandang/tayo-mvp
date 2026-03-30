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

// POST /api/transcribe — audio file → text via Whisper
router.post("/transcribe", upload.single("audio"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    const transcription = await openai.audio.transcriptions.create({
      file: new File([req.file.buffer], "audio.webm", { type: req.file.mimetype || "audio/webm" }),
      model: "whisper-1",
    });

    res.json({ text: transcription.text });
  } catch (err) {
    req.log.error({ err }, "Transcribe error");
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

// POST /api/speak — text → mp3 via ElevenLabs
router.post("/speak", async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text: string };
    if (!text) {
      res.status(400).json({ error: "No text provided" });
      return;
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: "ElevenLabs API key not configured" });
      return;
    }

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
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ errText, status: response.status }, "ElevenLabs error");
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
    const { messages, systemPrompt } = req.body as {
      messages: Array<{ role: string; content: string }>;
      systemPrompt: string;
    };

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
    const { conversationText, firstName } = req.body as {
      conversationText: string;
      firstName: string;
    };

    const prompt = `You are an expert life coach analyst. Based on the following voice conversation transcript between Tayo (an AI life coach) and ${firstName}, extract a rich structured profile.

Conversation:
${conversationText}

Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "firstName": "${firstName}",
  "dimensions": [
    {
      "name": "string (e.g. Emotional Wellbeing, Career & Purpose, Physical Health, Relationships, Financial Security)",
      "importance": number (1-10),
      "thriving": number (1-10),
      "tier": "foundational" | "growth" | "meaning",
      "themes": ["string"],
      "notableQuote": "string (direct quote from user if available)"
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
    const { profile } = req.body as { profile: Record<string, unknown> & { firstName?: string } };
    const firstName = typeof profile.firstName === "string" ? profile.firstName : "you";

    const prompt = `You are Tayo, a warm and analytically precise life coach. Based on this structured profile, write a narrative paragraph of 5-8 sentences for the dashboard.

Profile: ${JSON.stringify(profile, null, 2)}

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
    const { profile, conversationHistory, firstName } = req.body as {
      profile: Record<string, unknown>;
      conversationHistory: Array<{ role: string; content: string }>;
      firstName: string;
    };

    const conversationText = (conversationHistory || [])
      .map((m) => `${m.role === "user" ? firstName : "Tayo"}: ${m.content}`)
      .join("\n\n");

    const prompt = `Generate a deeply personal strategic life plan for ${firstName}. Be analytically precise, warm, and specific — ground every section in this user's actual profile and conversation. Do not use generic coaching language.

Profile:
${JSON.stringify(profile, null, 2)}

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
