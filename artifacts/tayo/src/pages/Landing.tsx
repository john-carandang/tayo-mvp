import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { ChevronRight, Mic, LayoutDashboard, BookOpen, Lock, Clock } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const STEPS = [
  {
    icon: Mic,
    label: "Voice Intake",
    desc: "Speak openly with Tayo — a 25–30 minute guided voice conversation that maps your life story, values, and what matters most to you.",
    accent: "#C4622D",
  },
  {
    icon: LayoutDashboard,
    label: "Your Dashboard",
    desc: "See your Journey to Date, a portrait of who you are now, and your Strategic Plan — all built from your own words.",
    accent: "#7A9E87",
  },
  {
    icon: BookOpen,
    label: "Next Moves & Growth",
    desc: "Between sessions, your Next Moves page holds your commitments, curated resources, and a countdown to your next session.",
    accent: "#D4A843",
  },
];

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

const TESTIMONIALS = [
  {
    quote: "Tayo kept me honest — it caught my incomplete thoughts and contradictions, and connected the dots of my thinking into a cohesive life strategic plan I couldn't have built on my own.",
    name: "Ian W.",
  },
  {
    quote: "It quickly became personal, even though I've never used anything like it before — it genuinely felt like it was built for me.",
    name: "Andy L.",
  },
  {
    quote: "Once I saw the dashboards, the benefit became clear — it picked up trends and rephrased things in ways I hadn't thought about, giving me a view of myself I didn't have before.",
    name: "Nestor F.",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  const [remoteProfile, setRemoteProfile] = useState<RemoteProfile | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

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
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>

      {/* ── Zone 1: Beige nav bar — sits above the hero in normal document flow ── */}
      <Navbar />

      {/* ── Zone 2: Hero — full-width image + centered semi-transparent text block ── */}
      <section
        style={{
          width: "100%",
          height: "85vh",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Hero image — <img> tag, no filters, no overlay, full warmth */}
        <img
          src={`${BASE_URL}/hero-bg.jpg`}
          alt="Four BIPOC young adults relaxing in a warm retro living room"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            display: "block",
          }}
        />

        {/* Centered semi-transparent beige text block */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(245, 240, 232, 0.88)",
            padding: "32px 48px",
            borderRadius: "4px",
            textAlign: "center",
            maxWidth: "640px",
            width: "90%",
          }}
        >
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 700,
              color: "#1C1008",
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Drown out the noise.<br />Find your signal.
          </h1>

          <p
            style={{
              fontSize: "15px",
              color: "#3D2B1F",
              marginTop: "12px",
              lineHeight: 1.7,
              maxWidth: "480px",
              margin: "12px auto 0",
            }}
          >
            Tayo is an AI coaching platform that helps you cut through the noise of modern life and tune into who you truly are and what truly matters most.
          </p>

          <button
            onClick={() => setLocation("/sign-up")}
            className="transition-all hover:scale-105"
            style={{
              display: "inline-block",
              backgroundColor: "#C4622D",
              color: "#FFFFFF",
              borderRadius: "24px",
              padding: "12px 28px",
              marginTop: "20px",
              fontWeight: 600,
              fontSize: "15px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Begin your journey →
          </button>
        </motion.div>
      </section>

      {/* Rest of page — constrained */}
      <main className="max-w-5xl mx-auto px-6">

        {/* ── 2. TESTIMONIALS ─────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="py-20"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.1 }}
                className="rounded-2xl p-7 flex flex-col justify-between"
                style={{
                  backgroundColor: "#FFFDF8",
                  border: "1px solid rgba(44,24,16,0.1)",
                  boxShadow: "0 2px 12px rgba(44,24,16,0.04)",
                }}
              >
                <p
                  className="text-sm leading-relaxed mb-5"
                  style={{ color: "#5C4A3D", fontStyle: "italic", fontFamily: "Georgia, serif" }}
                >
                  "{t.quote}"
                </p>
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#9B8E84", letterSpacing: "0.08em" }}
                >
                  — {t.name}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 3. THE PROBLEM ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="py-16 text-center"
          style={{ maxWidth: 680, margin: "0 auto" }}
        >
          <h2
            className="font-display text-3xl mb-10"
            style={{ color: "#2C1810" }}
          >
            The problem
          </h2>
          <div className="space-y-6">
            {[
              "Millennials and Gen Z crave holistic well-being, growth, and self-actualization more than any generation before them. The desire to live intentionally — across career, relationships, health, finances, and identity — is real and widespread.",
              "Fueling this is unprecedented access to social media, wellness apps, coaching content, and global perspectives. More tools, more advice, more frameworks than ever before.",
              "But access without clarity isn't freedom — it's overwhelm. The noise is louder than ever, and most people are left reacting to whoever is shouting the loudest rather than acting from a clear internal compass.",
            ].map((para, i) => (
              <p key={i} className="text-base leading-relaxed" style={{ color: "#746A5A" }}>
                {para}
              </p>
            ))}
          </div>
        </motion.section>

        {/* ── 4. THE SOLUTION ─────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="py-16 text-center rounded-3xl px-10 mb-8"
          style={{
            maxWidth: 680,
            margin: "0 auto 2rem",
            background: "linear-gradient(135deg, rgba(122,158,135,0.1) 0%, rgba(196,98,45,0.06) 100%)",
            border: "1px solid rgba(122,158,135,0.18)",
          }}
        >
          <h2
            className="font-display text-3xl mb-10"
            style={{ color: "#2C1810" }}
          >
            The solution
          </h2>
          <div className="space-y-6">
            {[
              "Tayo uses the power of AI and life coaching to help you cut through the noise and pressures of modern society — gaining real clarity into who you truly are, what matters most, and what it means to truly self-actualize.",
              "Tayo's coaching approach is grounded in ICF Core Competencies and Co-Active Coaching methodology — the gold standard of the professional coaching world — ensuring every conversation is purposeful, empowering, and genuinely transformative.",
              "Tayo learns and adapts across sessions — building a living portrait of who you are, surfacing culturally relevant resources at the right moments, and tracking your journey over time so growth compounds rather than resets.",
            ].map((para, i) => (
              <p key={i} className="text-base leading-relaxed" style={{ color: "#5C4A3D" }}>
                {para}
              </p>
            ))}
          </div>
        </motion.section>

        {/* ── 5. HOW TAYO WORKS ───────────────────────────────────────────── */}
        <section id="how-it-works" className="py-16 mb-8">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="font-display text-3xl text-center mb-12"
            style={{ color: "#2C1810" }}
          >
            How Tayo works
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 + i * 0.1 }}
                className="rounded-2xl p-7 relative"
                style={{
                  backgroundColor: "#FFFDF8",
                  border: "1px solid rgba(44,24,16,0.08)",
                  boxShadow: "0 2px 12px rgba(44,24,16,0.04)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: `${step.accent}18` }}
                >
                  <step.icon className="w-5 h-5" style={{ color: step.accent }} />
                </div>
                <div
                  className="absolute top-5 right-5 font-display text-3xl font-bold"
                  style={{ color: "rgba(44,24,16,0.06)" }}
                >
                  {i + 1}
                </div>
                <h3 className="font-display text-base mb-2" style={{ color: "#2C1810" }}>{step.label}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#746A5A" }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 6. CLOSING CTA ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center pb-24"
        >
          <h2 className="font-display text-3xl mb-4" style={{ color: "#2C1810" }}>
            Ready to begin?
          </h2>
          <p className="text-base mb-8" style={{ color: "#746A5A" }}>
            Your first session takes 25–30 minutes and gives you a lifetime of clarity.
          </p>
          <button
            onClick={() => setLocation("/sign-up")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105 shadow-lg mb-4"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            Begin your journey <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-xs" style={{ color: "#9B8E84" }}>
            <button onClick={() => setLocation("/faq")} className="underline" style={{ color: "#9B8E84" }}>
              Have questions? Read the FAQ
            </button>
          </p>
        </motion.section>

      </main>
    </div>
  );
}
