import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
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

// ── Testimonial carousel data ────────────────────────────────────────────────
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
  { left: T_ANDY,   center: T_IAN,   right: T_NESTOR },
  { left: T_NESTOR, center: T_ANDY,  right: T_IAN    },
  { left: T_IAN,    center: T_NESTOR, right: T_ANDY   },
];

// ── Solution pillar SVG icons ────────────────────────────────────────────────
const IconLineChart = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <polyline points="2,15 6,10 10,12 14,6 18,9" stroke="#D4A847" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="18" cy="9" r="2" fill="#D4A847"/>
  </svg>
);
const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7.5" stroke="#D4A847" strokeWidth="1.5"/>
    <line x1="10" y1="10" x2="10" y2="6.5" stroke="#D4A847" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="10" y1="10" x2="13" y2="12" stroke="#D4A847" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="10" cy="10" r="1.2" fill="#D4A847"/>
  </svg>
);
const IconNetwork = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="3.5" r="2" fill="#D4A847"/>
    <circle cx="3"  cy="16" r="2" fill="#D4A847"/>
    <circle cx="17" cy="16" r="2" fill="#D4A847"/>
    <line x1="10" y1="5.5" x2="3.8" y2="14" stroke="#D4A847" strokeWidth="1.2" strokeDasharray="2 2" strokeLinecap="round"/>
    <line x1="3.8" y1="16" x2="15" y2="16" stroke="#D4A847" strokeWidth="1.2" strokeDasharray="2 2"/>
    <line x1="10" y1="5.5" x2="16.2" y2="14" stroke="#D4A847" strokeWidth="1.2" strokeDasharray="2 2" strokeLinecap="round"/>
  </svg>
);

// ── How-it-works steps ───────────────────────────────────────────────────────
const HOW_STEPS = [
  {
    title: "Voice intake — your story, in your words",
    desc: "A 25–30 minute guided voice conversation that maps your life, values, and what matters most to you. No forms. No prompts. Just an open conversation.",
  },
  {
    title: "Your dashboard — a portrait of you",
    desc: "See your Journey to Date, a five-dimension whole-person view, and your Strategic Plan — all built entirely from your own words and patterns.",
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

  // Testimonial carousel
  const [tIdx, setTIdx] = useState(0);
  const [tVisible, setTVisible] = useState(true);
  const tTransitioning = useRef(false);

  const goToSlide = (next: number) => {
    if (tTransitioning.current) return;
    tTransitioning.current = true;
    setTVisible(false);
    setTimeout(() => {
      setTIdx(next);
      setTVisible(true);
      tTransitioning.current = false;
    }, 220);
  };

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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
      </div>
    );
  }

  // ─── Logged-in state ───────────────────────────────────────────────────────
  if (user) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
        <Navbar firstName={firstName} />

        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-sm font-medium mb-4" style={{ color: "#9B8E84" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>

            {!hasCompletedOnboarding ? (
              <>
                <h1 className="font-display text-4xl md:text-5xl mb-4" style={{ color: "#2C1810" }}>
                  {firstName ? `Welcome, ${firstName}.` : "Welcome to Tayo."}
                </h1>
                <p className="text-lg mb-10" style={{ color: "#5C4A3D" }}>
                  Let's set up your coaching experience before your first session.
                </p>
                <button
                  onClick={() => setLocation("/disclosures")}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-base transition-all hover:scale-105 shadow-lg"
                  style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
                >
                  Begin setup <ChevronRight className="w-5 h-5" />
                </button>
              </>
            ) : sessionLocked ? (
              <>
                <h1 className="font-display text-4xl md:text-5xl mb-4" style={{ color: "#2C1810" }}>
                  {firstName ? `Good to see you, ${firstName}.` : "Good to see you."}
                </h1>
                <p className="text-lg mb-2" style={{ color: "#5C4A3D" }}>
                  Your next session unlocks in{" "}
                  <span className="font-semibold" style={{ color: "#2C1810" }}>
                    {daysUntilUnlock} {daysUntilUnlock === 1 ? "day" : "days"}.
                  </span>
                </p>
                <p className="text-sm mb-10" style={{ color: "#9B8E84" }}>
                  The space between sessions is where the real work happens.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <div
                    className="flex items-center gap-3 px-6 py-3.5 rounded-full text-sm font-medium"
                    style={{ backgroundColor: "rgba(44,24,16,0.06)", color: "#746A5A" }}
                  >
                    <Lock className="w-4 h-4" />
                    <span>Session {nextSessionNumber} locked</span>
                    <span style={{ color: "#9B8E84" }}>·</span>
                    <Clock className="w-4 h-4" />
                    <span>{daysUntilUnlock}d until unlock</span>
                  </div>
                  <button
                    onClick={() => setLocation("/next-moves")}
                    className="px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105"
                    style={{ backgroundColor: "#7A9E87", color: "#F5F0E8" }}
                  >
                    View Next Moves
                  </button>
                </div>

                <div className="mt-8">
                  <button
                    onClick={() => setLocation("/dashboard")}
                    className="text-sm underline"
                    style={{ color: "#9B8E84" }}
                  >
                    Go to your dashboard
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 className="font-display text-4xl md:text-5xl mb-4" style={{ color: "#2C1810" }}>
                  {firstName
                    ? `${sessionCount === 0 ? "Ready to begin" : "Welcome back"}, ${firstName}.`
                    : (sessionCount === 0 ? "Ready to begin." : "Welcome back.")}
                </h1>
                <p className="text-lg mb-10" style={{ color: "#5C4A3D" }}>
                  {sessionCount === 0
                    ? "Your first session is ready. Find a quiet space and give yourself 25–30 minutes."
                    : `Session ${nextSessionNumber} is ready. ${coachName ? `${coachName} is waiting.` : "Let's continue."}`}
                </p>

                <button
                  onClick={() => setLocation("/intake")}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-base transition-all hover:scale-105 shadow-lg mb-6"
                  style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
                >
                  {sessionCount === 0
                    ? `Begin Session 1${coachName ? ` with ${coachName}` : ""}`
                    : `Begin Session ${nextSessionNumber}${coachName ? ` with ${coachName}` : ""}`}
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div className="mt-4">
                  <button
                    onClick={() => setLocation("/dashboard")}
                    className="text-sm underline"
                    style={{ color: "#9B8E84" }}
                  >
                    View your dashboard
                  </button>
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
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: "100vh" }}>
        <img
          src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1600&auto=format&fit=crop&q=80"
          onError={(e) => { (e.target as HTMLImageElement).src = `${BASE_URL}/hero-bg.jpg`; }}
          alt="Diverse friends relaxing in a warm cozy living room"
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: "cover",
            objectPosition: "center 40%",
            filter: "sepia(0.22) brightness(0.88) saturate(1.25) contrast(1.04)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.28) 22%, rgba(0,0,0,0.32) 55%, rgba(0,0,0,0.68) 80%, rgba(0,0,0,0.88) 100%)",
          }}
        />

        {/* Transparent nav */}
        <nav className="relative z-30 w-full px-6 py-4 flex items-center justify-between">
          <button onClick={() => setLocation("/")} className="font-display text-2xl font-semibold" style={{ color: "#FFFDF8" }}>
            Tayo
          </button>
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => { setLocation("/"); setTimeout(() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }), 100); }}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: "rgba(255,253,248,0.88)" }}
            >
              How it works
            </button>
            <button onClick={() => setLocation("/faq")} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: "rgba(255,253,248,0.88)" }}>
              FAQ
            </button>
          </div>
          <button
            onClick={() => setLocation("/sign-up")}
            className="px-5 py-2 rounded-full font-semibold text-sm transition-all hover:scale-105 shadow-md"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            Sign up / Log in
          </button>
        </nav>

        {/* Hero text */}
        <div className="relative z-20 flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "calc(100vh - 72px)", paddingBottom: "7rem" }}>
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: "easeOut" }}>
            <h1
              className="font-display mb-6"
              style={{ fontSize: "clamp(3.2rem, 9vw, 6rem)", lineHeight: 1.04, fontWeight: 800, color: "#FFFFFF", textShadow: "0 2px 32px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.18)", letterSpacing: "-0.01em" }}
            >
              Drown out the noise.<br />Find your signal.
            </h1>
            <p
              className="mb-10 mx-auto leading-relaxed"
              style={{ maxWidth: 480, fontSize: "clamp(0.95rem, 1.8vw, 1.1rem)", color: "rgba(255,253,248,0.9)", textShadow: "0 1px 10px rgba(0,0,0,0.28)" }}
            >
              Tayo is an AI coaching platform that helps you cut through the noise of modern life and tune into who you truly are and what truly matters most.
            </p>
            <button
              onClick={() => setLocation("/sign-up")}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105"
              style={{ backgroundColor: "#C4622D", color: "#F5F0E8", boxShadow: "0 6px 28px rgba(0,0,0,0.28)" }}
            >
              Begin your journey <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "#F5F0E8", padding: "72px 24px" }}>
        <p className="text-center text-xs font-semibold uppercase tracking-widest mb-10" style={{ color: "#C4622D", letterSpacing: "0.14em" }}>
          What people are saying
        </p>

        {/* Cards row */}
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1.6fr 1fr",
            gap: 16,
            opacity: tVisible ? 1 : 0,
            transform: tVisible ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 200ms ease, transform 200ms ease",
          }}
        >
          {/* Left side card */}
          <div
            className="rounded-xl p-5 flex flex-col justify-between"
            style={{ backgroundColor: "rgba(245,240,232,0.7)", border: "0.5px solid rgba(60,40,20,0.15)", minHeight: 180 }}
          >
            <p className="text-xs leading-relaxed" style={{ color: "#5C4A3D", fontStyle: "italic", fontFamily: "Georgia, serif" }}>
              "{tSet.left.quote}"
            </p>
            <p className="text-xs mt-3 font-medium" style={{ color: "#C4622D" }}>— {tSet.left.name}</p>
          </div>

          {/* Center featured card */}
          <div
            className="rounded-xl p-8 flex flex-col justify-between"
            style={{ backgroundColor: "#FFFFFF", border: "0.5px solid rgba(196,98,45,0.25)", position: "relative" }}
          >
            <div style={{ fontSize: 48, lineHeight: 1, color: "#C4622D", opacity: 0.25, fontFamily: "Georgia, serif", position: "absolute", top: 20, left: 24, userSelect: "none" }}>
              "
            </div>
            <p
              className="leading-relaxed pt-6"
              style={{ fontSize: 17, color: "#3D2B1F", fontFamily: "Georgia, serif" }}
            >
              {tSet.center.quote}
            </p>
            <p className="mt-5 text-xs font-medium" style={{ color: "#C4622D" }}>— {tSet.center.name}</p>
          </div>

          {/* Right side card */}
          <div
            className="rounded-xl p-5 flex flex-col justify-between"
            style={{ backgroundColor: "rgba(245,240,232,0.7)", border: "0.5px solid rgba(60,40,20,0.15)", minHeight: 180 }}
          >
            <p className="text-xs leading-relaxed" style={{ color: "#5C4A3D", fontStyle: "italic", fontFamily: "Georgia, serif" }}>
              "{tSet.right.quote}"
            </p>
            <p className="text-xs mt-3 font-medium" style={{ color: "#C4622D" }}>— {tSet.right.name}</p>
          </div>
        </div>

        {/* Navigation: arrows + dots */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => goToSlide((tIdx + TESTIMONIAL_SETS.length - 1) % TESTIMONIAL_SETS.length)}
            className="flex items-center justify-center rounded-full transition-all hover:border-[#C4622D] hover:text-[#C4622D]"
            style={{ width: 28, height: 28, border: "0.5px solid rgba(60,40,20,0.2)", color: "#5C4A3D", backgroundColor: "transparent" }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M6.5 2L3.5 5L6.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {TESTIMONIAL_SETS.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: i === tIdx ? "#C4622D" : "rgba(196,98,45,0.25)",
                border: "none",
                cursor: "pointer",
                transition: "background-color 200ms",
              }}
            />
          ))}
          <button
            onClick={() => goToSlide((tIdx + 1) % TESTIMONIAL_SETS.length)}
            className="flex items-center justify-center rounded-full transition-all hover:border-[#C4622D] hover:text-[#C4622D]"
            style={{ width: 28, height: 28, border: "0.5px solid rgba(60,40,20,0.2)", color: "#5C4A3D", backgroundColor: "transparent" }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </section>

      {/* ── THE PROBLEM ──────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "#EDE8DE", padding: "64px 48px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, alignItems: "start" }}>
          {/* Left — eyebrow + headline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "#C4622D", letterSpacing: "0.12em" }}>
              The problem
            </p>
            <h2 className="font-display" style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", lineHeight: 1.15, color: "#2C1810" }}>
              More tools,<br />more advice,{" "}
              <span style={{ color: "#C4622D" }}>more overwhelm.</span>
            </h2>
          </div>

          {/* Right — body copy */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: "#5a4a3f" }}>
              Millennials and Gen Z crave holistic well-being and self-actualization more than any generation before them — across career, relationships, health, finances, and beyond.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: "#5a4a3f" }}>
              But the explosion of wellness apps, social media advice, self-help content, and coaching frameworks hasn't made things clearer. It's made them louder. People are pulled in more directions than ever, reacting to the noisiest voices rather than their own.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: "#3D2B1F", fontWeight: 500 }}>
              Access without clarity isn't freedom — it's overwhelm. What's missing is a way to actually cut through.
            </p>
          </div>
        </div>
      </section>

      {/* ── THE SOLUTION ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "#2A1A0E", padding: "72px 48px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "#D4A847", letterSpacing: "0.12em" }}>
            The solution
          </p>
          <h2 className="font-display mb-7" style={{ fontSize: "clamp(1.5rem, 2.5vw, 1.9rem)", lineHeight: 1.3, color: "#F5F0E8" }}>
            A coaching companion that learns who you are — and helps you grow from there.
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(245,240,232,0.65)", marginBottom: 14 }}>
            Tayo uses the power of AI and life coaching to help you cut through the noise and pressures of modern society — gaining real clarity into who you truly are, what matters most, and what it means to truly self-actualize.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(245,240,232,0.65)", marginBottom: 36 }}>
            Grounded in ICF Core Competencies and Co-Active Coaching methodology — not a chatbot, not a journal, not a quiz.
          </p>

          {/* 3 pillar cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { Icon: IconLineChart,  title: "Learns across sessions",  desc: "Builds a living portrait of who you are over time — not a one-off snapshot" },
              { Icon: IconClock,      title: "Whole-person view",        desc: "Mental, physical, relational, financial, identity — all connected in one place" },
              { Icon: IconNetwork,    title: "Culturally grounded",       desc: "Surfaces resources and context relevant to your lived experience" },
            ].map(({ Icon, title, desc }) => (
              <div
                key={title}
                style={{
                  backgroundColor: "rgba(245,240,232,0.06)",
                  border: "0.5px solid rgba(245,240,232,0.12)",
                  borderRadius: 10,
                  padding: "22px 18px",
                  textAlign: "left",
                }}
              >
                <div style={{ width: 36, height: 36, backgroundColor: "rgba(196,98,45,0.2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Icon />
                </div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#F5F0E8", marginBottom: 6 }}>{title}</p>
                <p style={{ fontSize: 12, color: "rgba(245,240,232,0.5)", lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW TAYO WORKS ───────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ backgroundColor: "#F5F0E8", padding: "72px 48px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, alignItems: "start" }}>

          {/* Left — eyebrow + headline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "#C4622D", letterSpacing: "0.12em" }}>
              How it works
            </p>
            <h2 className="font-display" style={{ fontSize: "clamp(1.7rem, 2.8vw, 2.2rem)", lineHeight: 1.2, color: "#2C1810" }}>
              From open conversation to{" "}
              <span style={{ color: "#C4622D" }}>clear direction.</span>
            </h2>
          </div>

          {/* Right — connected step list */}
          <div>
            {HOW_STEPS.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 18,
                  paddingBottom: i < HOW_STEPS.length - 1 ? 28 : 0,
                  borderBottom: i < HOW_STEPS.length - 1 ? "0.5px solid rgba(60,40,20,0.1)" : "none",
                  marginBottom: i < HOW_STEPS.length - 1 ? 28 : 0,
                  position: "relative",
                }}
              >
                {/* Number circle + connector */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      width: 36, height: 36,
                      borderRadius: "50%",
                      backgroundColor: "#2A1A0E",
                      color: "#F5F0E8",
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  {i < HOW_STEPS.length - 1 && (
                    <div style={{ width: 1, flex: 1, backgroundColor: "rgba(60,40,20,0.15)", marginTop: 6 }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ paddingTop: 6 }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: "#2A1A0E", marginBottom: 6 }}>{step.title}</p>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: "#7a5c44" }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLOSING CTA ──────────────────────────────────────────────────── */}
      <section className="text-center" style={{ backgroundColor: "#F5F0E8", padding: "64px 24px 96px" }}>
        <h2 className="font-display text-3xl mb-4" style={{ color: "#2C1810" }}>
          Ready to begin?
        </h2>
        <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "#746A5A" }}>
          Your first session takes 25–30 minutes and gives you a lifetime of clarity.
        </p>
        <button
          onClick={() => setLocation("/sign-up")}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105 shadow-lg mb-4"
          style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
        >
          Begin your journey <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-xs">
          <button onClick={() => setLocation("/faq")} className="underline" style={{ color: "#9B8E84" }}>
            Have questions? Read the FAQ
          </button>
        </p>
      </section>

    </div>
  );
}
