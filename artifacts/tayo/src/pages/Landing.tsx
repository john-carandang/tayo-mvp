import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { ChevronRight, Lock, Clock } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const COACH_NAMES: Record<string, string> = {
  maya: "Maya",
  carlos: "Carlos",
  aisha: "Aisha",
  james: "James",
};

interface RemoteProfile {
  first_name?: string;
  last_name?: string;
  coach_id?: string;
  coach_voice_id?: string;
  last_session_ended_at?: string | null;
}

// ── Testimonial data ─────────────────────────────────────────────────────────
const T_IAN = {
  quote: "Tayo kept me honest — it caught my incomplete thoughts and contradictions, and connected the dots of my thinking into a cohesive life strategic plan I couldn't have built on my own.",
  name: "Ian W.",
};
const T_ANDY = {
  quote: "It quickly became personal, even though I've never used anything like it before — it genuinely felt like it was built for me.",
  name: "Andy L.",
};
const T_NESTOR = {
  quote: "Once I saw the dashboards, the benefit became clear — it rephrased things in ways I hadn't thought about, giving me a view of myself I didn't have before.",
  name: "Nestor F.",
};

const TESTIMONIAL_SETS = [
  { left: T_ANDY,   center: T_IAN,    right: T_NESTOR },
  { left: T_IAN,    center: T_NESTOR, right: T_ANDY   },
  { left: T_NESTOR, center: T_ANDY,   right: T_IAN    },
];

// ── Framer-motion variants for directional slide ─────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%" }),
  center: { x: 0 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%" }),
};
const slideTransition = { duration: 0.38, ease: [0.4, 0, 0.2, 1] as number[] };

// ── Solution pillar SVG icons (teal) ─────────────────────────────────────────
const IconLineChart = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <polyline points="2,15 6,10 10,12 14,6 18,9" stroke="#2A6B63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="18" cy="9" r="2" fill="#2A6B63"/>
  </svg>
);
const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7.5" stroke="#2A6B63" strokeWidth="1.5"/>
    <line x1="10" y1="10" x2="10" y2="6.5" stroke="#2A6B63" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="10" y1="10" x2="13" y2="12" stroke="#2A6B63" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="10" cy="10" r="1.2" fill="#2A6B63"/>
  </svg>
);
const IconNetwork = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="3.5" r="2" fill="#2A6B63"/>
    <circle cx="3"  cy="16" r="2" fill="#2A6B63"/>
    <circle cx="17" cy="16" r="2" fill="#2A6B63"/>
    <line x1="10" y1="5.5" x2="3.8" y2="14" stroke="#2A6B63" strokeWidth="1.2" strokeDasharray="2 2" strokeLinecap="round"/>
    <line x1="3.8" y1="16" x2="15" y2="16" stroke="#2A6B63" strokeWidth="1.2" strokeDasharray="2 2"/>
    <line x1="10" y1="5.5" x2="16.2" y2="14" stroke="#2A6B63" strokeWidth="1.2" strokeDasharray="2 2" strokeLinecap="round"/>
  </svg>
);

// ── How-it-works steps ───────────────────────────────────────────────────────
const HOW_STEPS = [
  {
    title: "Voice intake — your story, in your words",
    desc: "A 25–30 minute guided voice conversation that begins to map your life, values, and what matters most to you. No long forms. No prompts. Just an open conversation.",
  },
  {
    title: "Your dashboard — a portrait of you",
    desc: "See your Journey to Date, your holistic, whole-person view, and your Strategic Plan — all built entirely from your own words and lived experiences.",
  },
  {
    title: "Next moves — between sessions",
    desc: "Your Next Moves page holds your commitments, curated resources, and a countdown to your next session — so growth compounds rather than resets.",
  },
];

// ────────────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  const [remoteProfile, setRemoteProfile] = useState<RemoteProfile | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Testimonial carousel — directional slide
  const [tIdx, setTIdx] = useState(0);
  const [tDir, setTDir] = useState(1);

  const goToSlide = (next: number, explicitDir?: 1 | -1) => {
    if (next === tIdx) return;
    const dir = explicitDir ?? (next > tIdx ? 1 : -1);
    setTDir(dir);
    setTIdx(next);
  };
  const goForward = () => goToSlide((tIdx + 1) % TESTIMONIAL_SETS.length, 1);
  const goBackward = () => goToSlide((tIdx + TESTIMONIAL_SETS.length - 1) % TESTIMONIAL_SETS.length, -1);

  useEffect(() => {
    if (!user || loading) return;
    const load = async () => {
      setProfileLoading(true);
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const [profileRes, sessionsRes] = await Promise.all([
          fetch(`${BASE_URL}/api/profile`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch(`${BASE_URL}/api/sessions`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        ]);
        if (profileRes.ok) {
          const d = await profileRes.json();
          setRemoteProfile(d.profile ?? null);
        }
        if (sessionsRes.ok) {
          const d = await sessionsRes.json();
          setSessionCount((d.sessions ?? []).length);
        }
      } catch { /* silent */ }
      setProfileLoading(false);
    };
    load();
  }, [user, loading]);

  const firstName = remoteProfile?.first_name ?? localStorage.getItem("tayo_first_name") ?? undefined;
  const coachId = remoteProfile?.coach_id ?? localStorage.getItem("tayo_coach_id") ?? null;
  const coachName = coachId ? (COACH_NAMES[coachId] ?? "your coach") : null;
  const lastSessionEndedAt = remoteProfile?.last_session_ended_at;

  const sessionLocked = Boolean(
    lastSessionEndedAt &&
    new Date(lastSessionEndedAt).getTime() + 7 * 24 * 60 * 60 * 1000 > Date.now()
  );
  const daysUntilUnlock = sessionLocked && lastSessionEndedAt
    ? Math.ceil((new Date(lastSessionEndedAt).getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))
    : 0;

  const hasCompletedOnboarding = Boolean(coachId);
  const nextSessionNumber = (sessionCount ?? 0) + 1;

  if (loading || (user && profileLoading && !remoteProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F0E0" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
      </div>
    );
  }

  // ─── Logged-in state ───────────────────────────────────────────────────────
  if (user) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F7F0E0" }}>
        <Navbar firstName={firstName} />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-sm font-medium mb-4" style={{ color: "#9B8E84" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            {!hasCompletedOnboarding ? (
              <>
                <h1 className="font-display text-4xl md:text-5xl mb-4" style={{ color: "#1C1812" }}>
                  {firstName ? `Welcome, ${firstName}.` : "Welcome to Tayo."}
                </h1>
                <p className="text-lg mb-10" style={{ color: "#5a4a3f" }}>
                  Let's set up your coaching experience before your first session.
                </p>
                <button
                  onClick={() => setLocation("/disclosures")}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-base transition-all hover:scale-105 shadow-lg"
                  style={{ backgroundColor: "#C4622D", color: "#F7F0E0" }}
                >
                  Begin setup <ChevronRight className="w-5 h-5" />
                </button>
              </>
            ) : sessionLocked ? (
              <>
                <h1 className="font-display text-4xl md:text-5xl mb-4" style={{ color: "#1C1812" }}>
                  {firstName ? `Good to see you, ${firstName}.` : "Good to see you."}
                </h1>
                <p className="text-lg mb-2" style={{ color: "#5a4a3f" }}>
                  Your next session unlocks in{" "}
                  <span className="font-semibold" style={{ color: "#1C1812" }}>{daysUntilUnlock} {daysUntilUnlock === 1 ? "day" : "days"}.</span>
                </p>
                <p className="text-sm mb-10" style={{ color: "#9B8E84" }}>
                  The space between sessions is where the real work happens.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <div className="flex items-center gap-3 px-6 py-3.5 rounded-full text-sm font-medium" style={{ backgroundColor: "rgba(28,24,18,0.06)", color: "#746A5A" }}>
                    <Lock className="w-4 h-4" />
                    <span>Session {nextSessionNumber} locked</span>
                    <span style={{ color: "#9B8E84" }}>·</span>
                    <Clock className="w-4 h-4" />
                    <span>{daysUntilUnlock}d until unlock</span>
                  </div>
                  <button onClick={() => setLocation("/next-moves")} className="px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105" style={{ backgroundColor: "#2A6B63", color: "#F7F0E0" }}>
                    View Next Moves
                  </button>
                </div>
                <div className="mt-8">
                  <button onClick={() => setLocation("/dashboard")} className="text-sm underline" style={{ color: "#9B8E84" }}>Go to your dashboard</button>
                </div>
              </>
            ) : (
              <>
                <h1 className="font-display text-4xl md:text-5xl mb-4" style={{ color: "#1C1812" }}>
                  {firstName ? `${sessionCount === 0 ? "Ready to begin" : "Welcome back"}, ${firstName}.` : (sessionCount === 0 ? "Ready to begin." : "Welcome back.")}
                </h1>
                <p className="text-lg mb-10" style={{ color: "#5a4a3f" }}>
                  {sessionCount === 0 ? "Your first session is ready. Find a quiet space and give yourself 25–30 minutes." : `Session ${nextSessionNumber} is ready. ${coachName ? `${coachName} is waiting.` : "Let's continue."}`}
                </p>
                <button onClick={() => setLocation("/intake")} className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-base transition-all hover:scale-105 shadow-lg mb-6" style={{ backgroundColor: "#C4622D", color: "#F7F0E0" }}>
                  {sessionCount === 0 ? `Begin Session 1${coachName ? ` with ${coachName}` : ""}` : `Begin Session ${nextSessionNumber}${coachName ? ` with ${coachName}` : ""}`}
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="mt-4">
                  <button onClick={() => setLocation("/dashboard")} className="text-sm underline" style={{ color: "#9B8E84" }}>View your dashboard</button>
                </div>
              </>
            )}
          </motion.div>
        </main>
      </div>
    );
  }

  // ─── Logged-out state ──────────────────────────────────────────────────────
  const tSet = TESTIMONIAL_SETS[tIdx];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F0E0" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: "100vh" }}>
        <img
          src={`${BASE_URL}/assets/hero-bg.jpg`}
          alt="Friends laughing together in a warm, moody setting"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover", objectPosition: "center 35%" }}
        />

        {/* ── NAVBAR: shared component, transparent over hero ── */}
        <Navbar variant="transparent" />

        {/* ── HERO TEXT: plain white with text-shadow ── */}
        <div
          className="relative z-20 flex flex-col items-center justify-center text-center px-6"
          style={{ minHeight: "calc(100vh - 72px)", paddingBottom: "7rem" }}
        >
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: "easeOut" }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(40px, 7vw, 64px)",
                fontWeight: 500,
                lineHeight: 1.2,
                color: "#F7F0E0",
                textShadow: "0 2px 16px rgba(0,0,0,0.65)",
                marginBottom: 24,
                letterSpacing: "-0.01em",
              }}
            >
              Drown out the noise.<br />Find your signal.
            </h1>
            {/* Frosted pill subheading */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
              <p
                style={{
                  background: "rgba(20,12,6,0.45)",
                  borderRadius: 20,
                  padding: "6px 20px",
                  color: "rgba(247,240,224,0.96)",
                  fontSize: 17,
                  lineHeight: 1.6,
                  maxWidth: 460,
                }}
              >
                Tayo is an AI coaching platform that helps you cut through the noise of modern life and tune into who you truly are and what matters most.
              </p>
            </div>
            <button
              onClick={() => setLocation("/sign-up")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "16px 32px",
                borderRadius: 9999,
                fontSize: 16,
                fontWeight: 600,
                backgroundColor: "#C4622D",
                color: "#F7F0E0",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 28px rgba(0,0,0,0.32)",
                transition: "transform 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              Begin your journey <ChevronRight style={{ width: 20, height: 20 }} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "#F7F0E0", padding: "72px 24px" }}>
        <p style={{ textAlign: "center", fontSize: 15, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "#C4622D", marginBottom: 40 }}>
          What people are saying
        </p>

        {/* Sliding card container — overflow:hidden clips the incoming/outgoing cards */}
        <div style={{ maxWidth: 960, margin: "0 auto", position: "relative", overflow: "hidden" }}>
          <AnimatePresence initial={false} custom={tDir} mode="popLayout">
            <motion.div
              key={tIdx}
              custom={tDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.6fr 1fr",
                gap: 16,
              }}
            >
              {/* Left side card */}
              <div style={{ backgroundColor: "rgba(232,213,168,0.45)", border: "0.5px solid rgba(42,107,99,0.15)", borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 180 }}>
                <p style={{ fontSize: 17, lineHeight: 1.7, color: "#1C1812", fontFamily: "var(--font-display)", fontStyle: "normal" }}>
                  "{tSet.left.quote}"
                </p>
                <p style={{ fontSize: 14, marginTop: 12, fontWeight: 500, color: "#2A6B63", fontFamily: "var(--font-sans)" }}>— {tSet.left.name}</p>
              </div>

              {/* Center featured card */}
              <div style={{ backgroundColor: "#FFFFFF", border: "0.5px solid rgba(42,107,99,0.25)", borderRadius: 12, padding: "32px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                <div style={{ fontSize: 60, lineHeight: 1, color: "#2A6B63", opacity: 0.20, fontFamily: "Georgia, serif", position: "absolute", top: 20, left: 24, userSelect: "none" }}>"</div>
                <p style={{ fontSize: 24, lineHeight: 1.6, color: "#1C1812", fontFamily: "var(--font-display)", fontStyle: "normal", paddingTop: 28 }}>
                  {tSet.center.quote}
                </p>
                <p style={{ marginTop: 20, fontSize: 14, fontWeight: 500, color: "#2A6B63", fontFamily: "var(--font-sans)" }}>— {tSet.center.name}</p>
              </div>

              {/* Right side card */}
              <div style={{ backgroundColor: "rgba(232,213,168,0.45)", border: "0.5px solid rgba(42,107,99,0.15)", borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 180 }}>
                <p style={{ fontSize: 17, lineHeight: 1.7, color: "#1C1812", fontFamily: "var(--font-display)", fontStyle: "normal" }}>
                  "{tSet.right.quote}"
                </p>
                <p style={{ fontSize: 14, marginTop: 12, fontWeight: 500, color: "#2A6B63", fontFamily: "var(--font-sans)" }}>— {tSet.right.name}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Arrows + dots — dots update immediately (tIdx updates synchronously) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 28 }}>
          <button
            onClick={goBackward}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "0.5px solid rgba(42,107,99,0.25)", color: "#5C4A3D", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 150ms, color 150ms" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#2A6B63"; e.currentTarget.style.color = "#2A6B63"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(42,107,99,0.25)"; e.currentTarget.style.color = "#5C4A3D"; }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M6.5 2L3.5 5L6.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {TESTIMONIAL_SETS.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i, i > tIdx ? 1 : -1)}
              style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: i === tIdx ? "#2A6B63" : "rgba(42,107,99,0.2)", border: "none", cursor: "pointer", transition: "background-color 220ms" }}
            />
          ))}
          <button
            onClick={goForward}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "0.5px solid rgba(42,107,99,0.25)", color: "#5C4A3D", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 150ms, color 150ms" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#2A6B63"; e.currentTarget.style.color = "#2A6B63"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(42,107,99,0.25)"; e.currentTarget.style.color = "#5C4A3D"; }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </section>

      {/* ── THE PROBLEM ──────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "#C4622D", padding: "64px 48px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, alignItems: "start" }}>
          {/* Left */}
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(247,240,224,0.7)", marginBottom: 20 }}>
              The problem
            </p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 3.5vw, 3.25rem)", lineHeight: 1.1, color: "#F7F0E0", fontWeight: 700 }}>
              More tools,<br />more advice,{" "}
              <span style={{ color: "#F7E8A0" }}>more overwhelm.</span>
            </h2>
          </div>

          {/* Right */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ fontSize: 18, lineHeight: 1.8, color: "rgba(247,240,224,0.82)", fontFamily: "var(--font-display)", fontStyle: "normal" }}>
              Millennials and Gen Z crave holistic well-being and self-actualization more than any generation before them — across career, relationships, health, finances, and beyond.
            </p>
            <p style={{ fontSize: 18, lineHeight: 1.8, color: "rgba(247,240,224,0.82)", fontFamily: "var(--font-display)", fontStyle: "normal" }}>
              But the explosion of wellness apps, social media advice, self-help content, and coaching frameworks hasn't made things clearer. It's made them louder. People are pulled in more directions than ever, reacting to the noisiest voices rather than their own.
            </p>
            <p style={{ fontSize: 18, lineHeight: 1.8, color: "#F7F0E0", fontWeight: 500, fontFamily: "var(--font-display)", fontStyle: "normal" }}>
              Access without clarity isn't freedom — it's overwhelm. What's missing is a way to actually cut through.
            </p>
          </div>
        </div>
      </section>

      {/* ── THE SOLUTION ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "#1C1812", padding: "72px 48px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4A847", marginBottom: 20 }}>
            The solution
          </p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.7rem, 3vw, 2.5rem)", lineHeight: 1.25, color: "#F7F0E0", marginBottom: 28 }}>
            A coaching companion that learns who you are — and helps you grow from there.
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.8, color: "rgba(247,240,224,0.62)", marginBottom: 14, fontFamily: "var(--font-display)", fontStyle: "normal" }}>
            Tayo uses the power of AI and life coaching to help you cut through the noise and pressures of modern society — gaining real clarity into who you truly are, what matters most, and what it means to truly self-actualize.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.8, color: "rgba(247,240,224,0.62)", marginBottom: 36, fontFamily: "var(--font-display)", fontStyle: "normal" }}>
            Grounded in ICF Core Competencies and Co-Active Coaching methodology — not a chatbot, not a journal, not a quiz.
          </p>

          {/* 3 pillar cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { Icon: IconLineChart, title: "Learns across sessions",  desc: "Builds a living portrait of who you are over time — not a one-off snapshot" },
              { Icon: IconClock,     title: "Whole-person view",        desc: "Mental, physical, relational, financial, and beyond — all connected in one place" },
              { Icon: IconNetwork,   title: "Culturally grounded",       desc: "Surfaces resources and context relevant to your lived experience" },
            ].map(({ Icon, title, desc }) => (
              <div key={title} style={{ backgroundColor: "rgba(247,240,224,0.05)", border: "0.5px solid rgba(42,107,99,0.30)", borderRadius: 10, padding: "22px 18px", textAlign: "left" }}>
                <div style={{ width: 36, height: 36, backgroundColor: "rgba(42,107,99,0.20)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Icon />
                </div>
                <p style={{ fontSize: 17, fontWeight: 500, color: "#F7F0E0", marginBottom: 6, fontFamily: "var(--font-sans)" }}>{title}</p>
                <p style={{ fontSize: 15, color: "rgba(247,240,224,0.50)", lineHeight: 1.6, fontFamily: "var(--font-display)", fontStyle: "normal" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW TAYO WORKS ───────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ backgroundColor: "#F7F0E0", padding: "72px 48px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, alignItems: "start" }}>
          {/* Left */}
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#C4622D", marginBottom: 20 }}>
              How it works
            </p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.9rem, 3.5vw, 2.875rem)", lineHeight: 1.15, color: "#1C1812" }}>
              From open conversation to{" "}
              <span style={{ color: "#C4622D" }}>clear direction.</span>
            </h2>
          </div>

          {/* Right — connected steps */}
          <div>
            {HOW_STEPS.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 18,
                  paddingBottom: i < HOW_STEPS.length - 1 ? 28 : 0,
                  borderBottom: i < HOW_STEPS.length - 1 ? "0.5px solid rgba(42,107,99,0.12)" : "none",
                  marginBottom: i < HOW_STEPS.length - 1 ? 28 : 0,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#1C1812", color: "#F7F0E0", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  {i < HOW_STEPS.length - 1 && (
                    <div style={{ width: 1, flex: 1, backgroundColor: "rgba(42,107,99,0.20)", marginTop: 6 }} />
                  )}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <p style={{ fontSize: 20, fontWeight: 500, color: "#1C1812", marginBottom: 6, fontFamily: "var(--font-sans)" }}>{step.title}</p>
                  <p style={{ fontSize: 17, lineHeight: 1.7, color: "#7a5c44", fontFamily: "var(--font-display)", fontStyle: "normal" }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ──────────────────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid rgba(60,40,20,0.10)", margin: "0 48px" }} />

      {/* ── CLOSING CTA ──────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "#F7F0E0", padding: "64px 24px 96px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.875rem", color: "#1C1812", marginBottom: 16 }}>
          Ready to begin?
        </h2>
        <p style={{ fontSize: 16, marginBottom: 32, maxWidth: 400, margin: "0 auto 32px", color: "#746A5A" }}>
          Your first session takes 25–30 minutes and gives you a lifetime of clarity.
        </p>
        <button
          onClick={() => setLocation("/sign-up")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "16px 32px",
            borderRadius: 9999,
            fontSize: 16,
            fontWeight: 600,
            backgroundColor: "#C4622D",
            color: "#F7F0E0",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
            transition: "transform 150ms",
            marginBottom: 16,
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        >
          Begin your journey <ChevronRight style={{ width: 20, height: 20 }} />
        </button>
        <p style={{ fontSize: 12 }}>
          <button onClick={() => setLocation("/faq")} style={{ color: "#9B8E84", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
            Have questions? Read the FAQ
          </button>
        </p>
      </section>

    </div>
  );
}
