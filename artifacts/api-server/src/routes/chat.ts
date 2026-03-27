import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import {
  ChatBody,
  ChatResponse,
  GenerateNarrativeBody,
  GenerateNarrativeResponse,
  GeneratePlanBody,
  GeneratePlanResponse,
  GenerateHabitsBody,
  GenerateHabitsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

router.post("/chat", async (req, res) => {
  try {
    const body = ChatBody.parse(req.body);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: body.systemPrompt,
      messages: body.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const message =
      response.content[0].type === "text" ? response.content[0].text : "";

    const data = ChatResponse.parse({ message });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Chat error");
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

router.post("/generate-narrative", async (req, res) => {
  try {
    const body = GenerateNarrativeBody.parse(req.body);

    const dimensionSummary = body.dimensions
      .map(
        (d) =>
          `- ${d.name}: Thriving ${d.thriving}/10, Importance ${d.importance}/10, Gap ${d.importance - d.thriving}. User said: "${d.openText}"`
      )
      .join("\n");

    const prompt = `You are Tayo, a warm and analytically precise life coach. Based on the following intake data from ${body.firstName}, write a narrative paragraph of 5-10 sentences.

The narrative must:
- Be written in second person (address the user as "you")
- Reference specific thriving and importance scores by dimension name
- Quote or closely paraphrase the user's own open-text responses
- Name the dimensions with the largest gaps between importance and thriving
- Acknowledge genuine strengths (high thriving scores)
- Close with a forward-looking framing of what their coaching conversation is about to unlock
- Be honest, empowering, and specific — not generic coaching platitudes

User's data:
${dimensionSummary}

Write only the narrative paragraph. No preamble, no sign-off.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const narrative =
      response.content[0].type === "text" ? response.content[0].text : "";

    const data = GenerateNarrativeResponse.parse({ narrative });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Generate narrative error");
    res.status(500).json({ error: "Failed to generate narrative" });
  }
});

router.post("/generate-plan", async (req, res) => {
  try {
    const body = GeneratePlanBody.parse(req.body);

    const dimensionSummary = body.dimensions
      .map(
        (d) =>
          `- ${d.name}: Thriving ${d.thriving}/10, Importance ${d.importance}/10, Gap ${d.importance - d.thriving}. "${d.openText}"`
      )
      .join("\n");

    const conversationText = body.conversationHistory
      .map((m) => `${m.role === "user" ? body.firstName : "Tayo"}: ${m.content}`)
      .join("\n\n");

    const prompt = `Generate a personal strategic plan for ${body.firstName} with exactly six sections in this order. Write in second person. Be analytically precise, warm, and specific — ground every section in this user's actual responses and conversation. Avoid generic coaching language.

Dimension scores:
${dimensionSummary}

Coaching conversation:
${conversationText}

Generate the plan with these exact section headers and content:

(a) My Story: Current Self & Evolution
Write 4-6 sentences as a compelling biographical narrative of where this person is today, their arc, what has shifted, and what this moment represents. Not a list.

(b) Core Strengths & Differentiators
List 4-6 core strengths (labeled bullets, one-line descriptions). Then 3-4 differentiators — the qualities that make this person distinctly themselves.

(c) Strategic Challenges
List 3-4 key tensions framed as design problems, not failures. Each with one sentence on why it matters.

(d) Purpose Statement
Write 2-3 sentences articulating the user's core "why," grounded in their own language from the conversation.

(e) Core Values
List 3-5 values in order of importance. Re-term each to be personal and evocative (not "health" but "Competition-Ready Vitality"). One-line description per value.

(f) Focus Areas for Growth
List 2-3 dimensions most in need of attention based on gap between thriving and importance scores, with one sentence per area explaining why it matters now.

Format each section clearly with the section letter and title as header.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const plan =
      response.content[0].type === "text" ? response.content[0].text : "";

    const data = GeneratePlanResponse.parse({ plan });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Generate plan error");
    res.status(500).json({ error: "Failed to generate plan" });
  }
});

router.post("/generate-habits", async (req, res) => {
  try {
    const body = GenerateHabitsBody.parse(req.body);

    const prompt = `Based on this personal strategic plan for ${body.firstName}, generate 3-5 concrete habits and goals.

Strategic Plan:
${body.strategicPlan}

Each habit/goal must:
- Be explicitly tied to a named core value or focus area from the plan
- Goals should be specific, actionable, and measurable
- Habits should be small, realistic, and daily or weekly
- Include a label showing which core value or focus area it supports

Format each item as:
GOAL/HABIT [number]: [Title]
Type: Goal or Habit
Frequency: Daily / Weekly / One-time
Value/Focus Area: [name from the plan]
Description: [1-2 sentences on what to do and why]

Generate exactly 3-5 items. Be specific — no generic wellness advice. Ground everything in this person's actual plan.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const habits =
      response.content[0].type === "text" ? response.content[0].text : "";

    const data = GenerateHabitsResponse.parse({ habits });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Generate habits error");
    res.status(500).json({ error: "Failed to generate habits" });
  }
});

export default router;
