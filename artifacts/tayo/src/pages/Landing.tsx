import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, Mic, LayoutDashboard, MessageCircle, Map, Eye, EyeOff } from "lucide-react";

const STEPS = [
  { icon: Mic, label: "Voice Intake", desc: "Speak openly with Tayo — a 15–20 minute guided conversation that maps your life." },
  { icon: LayoutDashboard, label: "Your Dashboard", desc: "See your journey, who you are now, your strategic scorecard, and your next moves." },
  { icon: MessageCircle, label: "Coaching Session", desc: "Go deeper with Tayo — explore what your dashboard reveals and prepare for action." },
  { icon: Map, label: "Next Moves", desc: "Receive assignments tailored to your goals, with check-ins and resources to support you." },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { user, signIn, signUp, loading } = useAuth();

  const [mode, setMode] = useState<"none" | "signin" | "signup">("none");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  if (!loading && user) {
    setLocation("/disclosures");
    return null;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    const fn = mode === "signup" ? signUp : signIn;
    const { error } = await fn(email.trim(), password);
    setAuthLoading(false);
    if (error) {
      setAuthError(error);
    } else {
      setLocation("/disclosures");
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      {/* Header */}
      <header className="px-6 pt-8 pb-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-display text-2xl font-semibold" style={{ color: "#2C1810" }}>Tayo</span>
          <button
            onClick={() => setMode(mode === "signin" ? "none" : "signin")}
            className="text-sm font-medium transition-colors"
            style={{ color: "#7A9E87" }}
          >
            {mode === "signin" ? "Cancel" : "Sign in"}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="font-display text-5xl md:text-6xl mb-6 leading-tight" style={{ color: "#2C1810" }}>
            Know yourself.<br />Shape what's next.
          </h1>
          <p className="text-lg mb-4 max-w-xl mx-auto leading-relaxed" style={{ color: "#5C4A3D" }}>
            Tayo is an AI coaching companion that helps you map your life, understand your patterns, and move with clarity toward what matters most.
          </p>
          <p className="text-sm max-w-lg mx-auto px-4 py-3 rounded-xl mb-8" style={{ color: "#746A5A", backgroundColor: "rgba(122,158,135,0.12)", fontStyle: "italic" }}>
            Tayo is an AI coaching tool designed to support self-understanding and personal growth. It is not a human coach, therapist, or mental health service.
          </p>

          <button
            onClick={() => setMode("signup")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105 shadow-lg"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            Begin your journey
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Auth Form */}
        <AnimatePresence>
          {mode !== "none" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="max-w-sm mx-auto mb-16 overflow-hidden"
            >
              <div className="rounded-2xl p-8 shadow-lg" style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)" }}>
                <h2 className="font-display text-xl mb-6 text-center" style={{ color: "#2C1810" }}>
                  {mode === "signup" ? "Create your account" : "Welcome back"}
                </h2>
                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#5C4A3D" }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      style={{ backgroundColor: "#F5F0E8", border: "1.5px solid rgba(44,24,16,0.2)", color: "#2C1810" }}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#5C4A3D" }}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all pr-10"
                        style={{ backgroundColor: "#F5F0E8", border: "1.5px solid rgba(44,24,16,0.2)", color: "#2C1810" }}
                        placeholder={mode === "signup" ? "Choose a password (6+ chars)" : "Your password"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: "#9B8E84" }}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {authError && (
                    <p className="text-xs text-center" style={{ color: "#C4622D" }}>{authError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                    style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
                  >
                    {authLoading ? "…" : mode === "signup" ? "Create account & begin" : "Sign in"}
                  </button>
                </form>
                <p className="text-center text-xs mt-4" style={{ color: "#9B8E84" }}>
                  {mode === "signup" ? "Already have an account? " : "New here? "}
                  <button
                    onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setAuthError(""); }}
                    className="underline"
                    style={{ color: "#7A9E87" }}
                  >
                    {mode === "signup" ? "Sign in" : "Create one"}
                  </button>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4-Step Journey Map */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-20"
        >
          <h2 className="font-display text-2xl text-center mb-10" style={{ color: "#2C1810" }}>
            Your journey in four steps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="rounded-2xl p-6 relative"
                style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)", boxShadow: "0 2px 12px rgba(44,24,16,0.04)" }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(196,98,45,0.12)" }}>
                  <step.icon className="w-5 h-5" style={{ color: "#C4622D" }} />
                </div>
                <div className="absolute top-4 right-4 text-xs font-bold" style={{ color: "rgba(44,24,16,0.2)" }}>{i + 1}</div>
                <h3 className="font-display text-base mb-2" style={{ color: "#2C1810" }}>{step.label}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#746A5A" }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Imagery / value proposition */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-3xl p-10 mb-16 text-center"
          style={{ background: "linear-gradient(135deg, rgba(122,158,135,0.15) 0%, rgba(212,168,67,0.08) 100%)", border: "1px solid rgba(122,158,135,0.2)" }}
        >
          <p className="font-display text-xl mb-4" style={{ color: "#2C1810" }}>
            "The most important conversation you'll ever have is the one you have with yourself."
          </p>
          <p className="text-sm" style={{ color: "#7A9E87" }}>Tayo gives that conversation structure, depth, and direction.</p>
        </motion.div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => setMode("signup")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105 shadow-lg"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            Begin your journey
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-xs mt-4" style={{ color: "#9B8E84" }}>Free to get started · No credit card required</p>
        </div>
      </main>
    </div>
  );
}
