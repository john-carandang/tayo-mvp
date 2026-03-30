import { useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile } from "@/hooks/use-tayo-state";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Strip all Markdown artifacts before display or TTS
function cleanPlanText(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
}

async function speakText(text: string): Promise<HTMLAudioElement> {
  const cleaned = cleanPlanText(text);
  const res = await fetch(`${BASE_URL}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: cleaned }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  return new Audio(URL.createObjectURL(blob));
}

// Safe inline bold renderer — splits on *text* markers without dangerouslySetInnerHTML
function InlineText({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
      )}
    </>
  );
}

// Plan section: sage uppercase header + gold divider + brown body text per spec
function PlanSection({ heading, body }: { heading: string; body: string }) {
  const paragraphs = body.split(/\n\n+/).filter(Boolean);

  return (
    <div className="mb-7">
      <h3 style={{ color: "#638863", fontSize: "16px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
        {heading}
      </h3>
      <div style={{ borderBottom: "1px solid #D4A843", marginBottom: "12px" }} />
      <div className="space-y-3">
        {paragraphs.map((para, j) => {
          const lines = para.split("\n").filter(l => l.trim());
          const isBulletBlock = lines.every(l => /^[-•*]/.test(l.trim()));

          if (isBulletBlock) {
            return (
              <ul key={j} className="space-y-1.5">
                {lines.map((line, k) => (
                  <li key={k} className="flex gap-2" style={{ fontSize: "14px", lineHeight: "1.9", color: "#5C4030" }}>
                    <span style={{ color: "#C4622D", marginTop: "2px", flexShrink: 0, fontWeight: "bold" }}>·</span>
                    <InlineText text={line.replace(/^[-•*]\s*/, "")} />
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={j} style={{ fontSize: "14px", lineHeight: "1.9", color: "#5C4030" }}>
              <InlineText text={para} />
            </p>
          );
        })}
      </div>
    </div>
  );
}

function renderPlan(raw: string): ReactNode {
  const cleaned = cleanPlanText(raw);

  // Try to split by lines that look like section headers
  const sectionRegex = /^(?![-•*\s])([^\n]{3,60})\n([\s\S]+?)(?=\n(?![-•*\s])[^\n]{3,60}\n|$)/gm;

  const sections: Array<{ heading: string; body: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(cleaned)) !== null) {
    const heading = match[1].trim();
    const body = match[2].trim();
    if (heading && body) {
      sections.push({ heading, body });
    }
  }

  if (sections.length >= 2) {
    return sections.map((s, i) => <PlanSection key={i} heading={s.heading} body={s.body} />);
  }

  // Fallback: render as paragraphs
  const paragraphs = cleaned.split(/\n\n+/).filter(Boolean);
  return paragraphs.map((para, i) => {
    const lines = para.split("\n").filter(l => l.trim());
    const isShortLine = lines.length === 1 && para.trim().length < 60;

    if (isShortLine) {
      return (
        <div key={i} className="mt-6 mb-2">
          <h3 style={{ color: "#638863", fontSize: "16px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            {para.trim()}
          </h3>
          <div style={{ borderBottom: "1px solid #D4A843" }} />
        </div>
      );
    }

    const isBulletBlock = lines.every(l => /^[-•*]/.test(l.trim()));
    if (isBulletBlock) {
      return (
        <ul key={i} className="space-y-1.5 mb-3">
          {lines.map((line, k) => (
            <li key={k} className="flex gap-2" style={{ fontSize: "14px", lineHeight: "1.9", color: "#5C4030" }}>
              <span style={{ color: "#C4622D", marginTop: "2px", flexShrink: 0, fontWeight: "bold" }}>·</span>
              <InlineText text={line.replace(/^[-•*]\s*/, "")} />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={i} className="mb-3" style={{ fontSize: "14px", lineHeight: "1.9", color: "#5C4030" }}>
        <InlineText text={para} />
      </p>
    );
  });
}

export default function Plan() {
  const [, setLocation] = useLocation();
  const { profile, clearProfile, isHydrated } = useTayoProfile();
  const [plan, setPlan] = useState<string | null>(null);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isNarrating, setIsNarrating] = useState(false);
  const [narrationStarted, setNarrationStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchedAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("tayo_plan");
    if (stored) setPlan(stored);
  }, []);

  useEffect(() => {
    if (isHydrated && !profile) setLocation("/");
  }, [isHydrated, profile, setLocation]);

  // Pre-fetch TTS audio on load — do NOT auto-play
  useEffect(() => {
    if (!plan || narrationStarted) return;
    setNarrationStarted(true);

    const first500Words = cleanPlanText(plan).split(/\s+/).slice(0, 500).join(" ");
    const narrationText = `Here is ${profile?.firstName ?? "your"} personal strategic plan. ${first500Words}`;

    speakText(narrationText)
      .then((audio) => { prefetchedAudioRef.current = audio; })
      .catch(() => {});
  }, [plan, narrationStarted, profile]);

  const handleToggleNarration = useCallback(async () => {
    if (!plan) return;
    if (isNarrating) {
      audioRef.current?.pause();
      audioRef.current = null;
      setIsNarrating(false);
      setOrbState("idle");
      return;
    }
    setOrbState("speaking");
    setIsNarrating(true);
    try {
      const first500Words = cleanPlanText(plan).split(/\s+/).slice(0, 500).join(" ");
      const narrationText = `Here is ${profile?.firstName ?? "your"} personal strategic plan. ${first500Words}`;
      const audio = prefetchedAudioRef.current ?? await speakText(narrationText);
      prefetchedAudioRef.current = null;
      audioRef.current = audio;
      audio.play();
      audio.onended = () => { setIsNarrating(false); setOrbState("idle"); };
      audio.onerror = () => { setIsNarrating(false); setOrbState("idle"); };
    } catch {
      setIsNarrating(false);
      setOrbState("idle");
    }
  }, [plan, isNarrating, profile]);

  const handleStartOver = () => {
    audioRef.current?.pause();
    clearProfile();
    setLocation("/");
  };

  if (!isHydrated || !profile) return null;

  const year = new Date().getFullYear();

  // Recovery path: profile exists but plan hasn't been generated yet
  if (!plan) {
    return (
      <StepLayout step={4} title="Your Strategic Plan"
        description="Your personal strategic plan, built from everything you shared. This is a living document — a mirror of who you are and a compass for where you are going.">
        <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-24 gap-6 text-center">
          <p className="text-muted-foreground text-base">
            Your strategic plan hasn't been generated yet.
          </p>
          <button
            onClick={() => setLocation("/chat")}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-semibold text-sm hover:bg-primary/90 transition-all"
          >
            Go to Coaching Session
          </button>
        </div>
      </StepLayout>
    );
  }

  return (
    <StepLayout
      step={4}
      title="Your Strategic Plan"
      description="Your personal strategic plan, built from everything you shared. This is a living document — a mirror of who you are and a compass for where you are going."
    >
      <div className="max-w-2xl mx-auto space-y-6 pb-16">

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-warm overflow-hidden">
          {/* Document header */}
          <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Personal Strategic Plan</p>
              <h2 className="text-lg font-display text-foreground">
                {profile.firstName}&apos;s {year} Life Strategic Plan
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <VoiceOrb state={orbState} size={36} onClick={handleToggleNarration} />
              <button
                onClick={handleToggleNarration}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isNarrating ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {isNarrating ? "Stop" : "Listen"}
              </button>
            </div>
          </div>

          {/* Plan body */}
          <div className="px-6 py-5">
            {renderPlan(plan)}
          </div>
        </motion.div>

        {/* Values */}
        {(profile.values ?? []).length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="card-warm p-4">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Core Values</p>
            <div className="flex flex-wrap gap-2">
              {profile.values.map((v, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-xs font-medium text-foreground bg-background/60 border border-border">
                  {v}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Start over */}
        <div className="flex justify-center pt-4">
          <button
            onClick={handleStartOver}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-full px-5 py-2.5 hover:border-foreground/20 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Start a new session
          </button>
        </div>

      </div>
    </StepLayout>
  );
}
