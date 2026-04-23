import { createContext, useContext, useState, type ReactNode } from "react";
import type { TayoDimension, TayoLifeEvent } from "@/hooks/use-tayo-state";

declare const __DEMO_MODE_ENABLED__: boolean;

// ─── Mock snapshot data (mirrors Snapshot type from Dashboard) ────────────────
export const DEMO_SNAPSHOT = {
  id: "demo-snapshot-1",
  snapshot_version: 1,
  created_at: new Date().toISOString(),
  narrative_blurb:
    "Alex is a first-generation Filipino-American working in tech operations at a mid-size startup — successful on paper, but navigating a deep internal crossroads. Core values of family, creativity, integrity, and impact aren't fully reflected in day-to-day work. In our first session, key themes emerged around identity, belonging, and the fear of making the wrong choice. The discomfort Alex is feeling is a signal worth listening to.",
  chapter_cards: [
    {
      label: "Started first corporate job after graduating — felt proud but quickly realized the work didn't energize me the way I hoped.",
      approximateYear: 2020,
      chapterName: "First Corporate Chapter",
      actualizationLevel: 5,
      type: "turning_point",
    },
    {
      label: "Moved to San Francisco at 25 — built independence, grew my network, but also felt the pressure of keeping up with peers.",
      approximateYear: 2023,
      chapterName: "The SF Move",
      actualizationLevel: 6,
      type: "stable",
    },
    {
      label: "Began therapy in 2023 — first time I actively invested in understanding myself. Opened a lot of doors.",
      approximateYear: 2023,
      chapterName: "Opening the Door",
      actualizationLevel: 7,
      type: "peak",
    },
  ] satisfies TayoLifeEvent[],
  portrait_stats: [
    {
      name: "Mental / Emotional",
      thriving: 6,
      importance: 8,
      tier: "foundational",
      themes: ["self-awareness", "therapy", "emotional processing"],
      notableQuote: "First time I actively invested in understanding myself.",
      legendDescription: "Growing steadily — therapy has opened new self-awareness",
    },
    {
      name: "Career",
      thriving: 3,
      importance: 9,
      tier: "growth",
      themes: ["values alignment", "career pivot", "purpose"],
      notableQuote: "Successful on paper but feeling disconnected from the work.",
      legendDescription: "At a crossroads — seeking meaning and values alignment",
    },
    {
      name: "Physical",
      thriving: 5,
      importance: 7,
      tier: "foundational",
      themes: ["movement", "consistency", "energy"],
      notableQuote: "Desire to get back to consistent physical activity.",
      legendDescription: "Rebuilding — wants movement as mental health maintenance",
    },
    {
      name: "Social / Relationships",
      thriving: 5,
      importance: 8,
      tier: "growth",
      themes: ["belonging", "manager relationship", "network"],
      notableQuote: "Navigating a difficult relationship with my manager.",
      legendDescription: "Strong network, navigating key professional relationship",
    },
    {
      name: "Financial",
      thriving: 7,
      importance: 7,
      tier: "meaning",
      themes: ["stability", "security", "foundation"],
      notableQuote: "Financial stability provides a foundation to take calculated risks.",
      legendDescription: "Stable — not a primary stressor, enabler of other choices",
    },
  ] satisfies TayoDimension[],
  scorecard: {
    purpose:
      "Explore what a values-aligned life looks like — one where career, creativity, and connection reflect who Alex truly is.",
    values: ["Family", "Creativity", "Integrity", "Impact"],
    strengths: [
      "Self-awareness and willingness to do the work",
      "Resilience — navigated a major city move and career transition",
      "Network building and relationship intelligence",
      "Intellectual curiosity and openness to growth",
    ],
    challenges: [
      "Fear of making the wrong choice leading to analysis paralysis",
      "External validation over internal compass",
      "Difficulty setting boundaries at work",
    ],
    focusAreas: [
      "Career: Explore a values-aligned pivot over 12 months — start with informational conversations in adjacent fields.",
      "Physical: Re-establish 3x/week movement as mental health maintenance, not fitness optimization.",
      "Relationships: One honest manager conversation about workload and recognition within 30 days.",
    ],
  },
};

// ─── Mock assignments (Next Moves) ────────────────────────────────────────────
export const DEMO_ASSIGNMENTS = [
  {
    id: "demo-move-1",
    title: "Schedule 2 informational interviews",
    description: "In fields you're curious about — due in 2 weeks",
    type: "one_off_task" as const,
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "pending" as const,
    reflection: null,
  },
  {
    id: "demo-move-2",
    title: "Block 3 movement sessions on calendar",
    description: "Non-negotiable — this week. Treat it as a meeting with yourself.",
    type: "daily_habit" as const,
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "pending" as const,
    reflection: null,
  },
  {
    id: "demo-move-3",
    title: "Draft talking points for manager conversation",
    description: "Prepare in advance — focus on workload and recognition",
    type: "one_off_task" as const,
    due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "pending" as const,
    reflection: null,
  },
];

// ─── Mock resources ───────────────────────────────────────────────────────────
export const DEMO_RESOURCES = [
  {
    title: "Designing Your Life",
    type: "book" as const,
    description:
      "Bill Burnett & Dave Evans apply design thinking to career and life decisions — perfect for someone at a crossroads.",
    url: "https://designingyour.life",
  },
  {
    title: "The Tim Ferriss Show — How to Design a Life",
    type: "podcast" as const,
    description: "Frameworks for intentional career pivots and lifestyle design.",
    url: "https://tim.blog/podcast",
  },
  {
    title: "Feeling Good at Work",
    type: "article" as const,
    description: "Harvard Business Review on re-aligning work with personal values.",
    url: "https://hbr.org",
  },
  {
    title: "Burnout to Balance — The Anatomy of Overwhelm",
    type: "youtube" as const,
    description: "A research-backed look at stress, identity, and sustainable recovery.",
    url: "https://www.youtube.com",
  },
];

// ─── Mock session summary ─────────────────────────────────────────────────────
export const DEMO_SESSION_SUMMARY =
  "In our first session, Alex explored the tension between external success and internal fulfillment. Key themes: identity, belonging, and the fear of making the wrong choice. Alex left with more clarity that the discomfort they're feeling is a signal worth listening to — not a problem to solve quickly.";

// ─── Mock AI coaching system prompt (for coaching session context) ─────────────
export const DEMO_COACHING_CONTEXT = `You are coaching Alex Rivera, 28, based in San Francisco. Here is their profile:

INTAKE SUMMARY: Alex is a first-generation Filipino-American working in tech operations at a mid-size startup. Successful on paper but feeling disconnected from their work and unsure whether to pursue a career pivot, go back to school, or stay the course. Core values: family, creativity, integrity, and impact. Currently navigating a difficult relationship with their manager, a recent breakup, and a desire to get back to consistent physical activity.

DIMENSION SCORES (1–10):
- Mental / Emotional: 6
- Career: 4
- Physical: 5
- Social / Relationships: 5
- Financial: 7

PREVIOUS SESSION: In session 1, Alex explored the tension between external success and internal fulfillment. Key themes: identity, belonging, and the fear of making the wrong choice. Alex left with more clarity that the discomfort they're feeling is a signal worth listening to.

CURRENT COMMITMENTS:
- Schedule 2 informational interviews in adjacent fields (due in 2 weeks)
- Block 3 movement sessions per week (non-negotiable, this week)
- Draft talking points for manager conversation (due Friday)

Use this context to guide the session. Ask how they're doing with their commitments, and explore what's top of mind today.`;

// ─── Demo profile ─────────────────────────────────────────────────────────────
export const DEMO_PROFILE = {
  first_name: "Alex",
  last_name: "Rivera",
  coach_id: "maya",
  last_session_ended_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
};

// ─── Context ──────────────────────────────────────────────────────────────────
interface DemoContextValue {
  isDemoMode: boolean;
  isDemoEnabled: boolean;
  enableDemo: () => void;
  bannerVisible: boolean;
  dismissBanner: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

const SESSION_KEY = "tayo_demo_active";

export function DemoProvider({ children }: { children: ReactNode }) {
  const isDemoEnabled = (() => {
    try { return __DEMO_MODE_ENABLED__; } catch { return false; }
  })();

  const [isDemoMode, setIsDemoMode] = useState(() => {
    if (!isDemoEnabled) return false;
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
  });
  const [bannerVisible, setBannerVisible] = useState(() => {
    try { return sessionStorage.getItem("tayo_demo_banner_dismissed") !== "1"; } catch { return true; }
  });

  const enableDemo = () => {
    if (!isDemoEnabled) return;
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* non-fatal */ }
    setIsDemoMode(true);
  };

  const dismissBanner = () => {
    try { sessionStorage.setItem("tayo_demo_banner_dismissed", "1"); } catch { /* non-fatal */ }
    setBannerVisible(false);
  };

  return (
    <DemoContext.Provider value={{ isDemoMode, isDemoEnabled, enableDemo, bannerVisible, dismissBanner }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
