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

export default function Landing() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  const [remoteProfile, setRemoteProfile] = useState<RemoteProfile | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch profile when logged in
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
      <Navbar />

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24"
        >
          <h1 className="font-display text-5xl md:text-7xl mb-6 leading-tight" style={{ color: "#2C1810", lineHeight: "1.1" }}>
            Know yourself.<br />Shape what's next.
          </h1>
          <p className="text-lg mb-4 max-w-2xl mx-auto leading-relaxed" style={{ color: "#5C4A3D" }}>
            Tayo is an AI coaching companion that helps you map your life, understand your patterns, and move with clarity toward what matters most.
          </p>
          <p className="text-sm max-w-lg mx-auto mb-10 px-4 py-3 rounded-xl" style={{ color: "#746A5A", backgroundColor: "rgba(122,158,135,0.1)", fontStyle: "italic" }}>
            Tayo is an AI coaching tool. It is not a human coach, therapist, or mental health service.
          </p>

          <button
            onClick={() => setLocation("/sign-up")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105 shadow-lg"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            Begin your journey <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-xs mt-4" style={{ color: "#9B8E84" }}>Free to get started · No credit card required</p>
        </motion.section>

        {/* Portrait grid — BIPOC representation placeholder */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-24"
        >
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { initials: "A.M.", bg: "rgba(196,98,45,0.12)", color: "#C4622D", caption: "\"I finally understand why I keep getting in my own way.\"" },
              { initials: "J.O.", bg: "rgba(122,158,135,0.15)", color: "#7A9E87", caption: "\"My dashboard showed me a pattern I'd never seen before.\"" },
              { initials: "S.K.", bg: "rgba(212,168,67,0.12)", color: "#D4A843", caption: "\"The session felt more real than years of journaling.\"" },
            ].map((person, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="rounded-2xl p-6 text-center"
                style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-sm mx-auto mb-4"
                  style={{ backgroundColor: person.bg, color: person.color }}
                >
                  {person.initials}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#746A5A", fontStyle: "italic" }}>
                  {person.caption}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* How it works */}
        <section id="how-it-works" className="mb-24">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
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
                transition={{ delay: 0.3 + i * 0.1 }}
                className="rounded-2xl p-7 relative"
                style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)", boxShadow: "0 2px 12px rgba(44,24,16,0.04)" }}
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

        {/* Pull quote */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-3xl p-12 mb-24 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(122,158,135,0.12) 0%, rgba(196,98,45,0.06) 100%)",
            border: "1px solid rgba(122,158,135,0.2)",
          }}
        >
          <p className="font-display text-2xl md:text-3xl mb-4" style={{ color: "#2C1810", fontStyle: "italic", lineHeight: "1.4" }}>
            "The most important conversation you'll ever have is the one you have with yourself."
          </p>
          <p className="text-sm" style={{ color: "#7A9E87" }}>
            Tayo gives that conversation structure, depth, and direction.
          </p>
        </motion.section>

        {/* Bottom CTA */}
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
            Your first session is free. It takes 25–30 minutes and gives you a lifetime of clarity.
          </p>
          <button
            onClick={() => setLocation("/sign-up")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105 shadow-lg"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            Begin your journey <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-xs mt-4" style={{ color: "#9B8E84" }}>
            Free to get started · No credit card required ·{" "}
            <button onClick={() => setLocation("/faq")} className="underline" style={{ color: "#9B8E84" }}>
              Have questions?
            </button>
          </p>
        </motion.section>
      </main>
    </div>
  );
}
