import { useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile } from "@/hooks/use-tayo-state";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function speakText(text: string): Promise<HTMLAudioElement> {
  const res = await fetch(`${BASE_URL}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  return new Audio(URL.createObjectURL(blob));
}

function formatPlan(raw: string, firstName: string): ReactNode {
  const year = new Date().getFullYear();

  const sections = raw
    .split(/\n(?=[A-Z][^\n]{3,60}\n)/)
    .filter(Boolean);

  if (sections.length <= 1) {
    const paragraphs = raw.split("\n\n").filter(Boolean);
    return (
      <>
        {paragraphs.map((para, i) => {
          if (para.trim().length < 80 && !para.includes("\n")) {
            return (
              <h3 key={i} className="text-lg font-display font-semibold text-foreground mt-6 mb-2 pb-1 border-b border-border">
                {para.trim()}
              </h3>
            );
          }
          const lines = para.split("\n");
          if (lines.every(l => l.trim().match(/^[-•*]/) || l.trim() === "")) {
            return (
              <ul key={i} className="space-y-2 my-3 pl-2">
                {lines.filter(l => l.trim()).map((line, j) => (
                  <li key={j} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                    <span className="text-primary mt-0.5 flex-shrink-0">·</span>
                    <span dangerouslySetInnerHTML={{
                      __html: line.replace(/^[-•*]\s*/, "").replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
                    }} />
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed my-3"
              dangerouslySetInnerHTML={{
                __html: para.replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
              }}
            />
          );
        })}
      </>
    );
  }

  return (
    <>
      {sections.map((section, i) => {
        const lines = section.trim().split("\n");
        const heading = lines[0].trim();
        const body = lines.slice(1).join("\n").trim();

        return (
          <div key={i} className="mb-8">
            <h3 className="text-base font-display font-semibold text-foreground mb-3 pb-1.5 border-b border-border/60">
              {heading}
            </h3>
            {body.split("\n\n").filter(Boolean).map((para, j) => {
              const paraLines = para.split("\n");
              if (paraLines.every(l => l.trim().match(/^[-•*]/) || l.trim() === "")) {
                return (
                  <ul key={j} className="space-y-1.5 mb-3 pl-2">
                    {paraLines.filter(l => l.trim()).map((line, k) => (
                      <li key={k} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                        <span className="text-primary mt-0.5 flex-shrink-0">·</span>
                        <span dangerouslySetInnerHTML={{
                          __html: line.replace(/^[-•*]\s*/, "").replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
                        }} />
                      </li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={j} className="text-sm text-muted-foreground leading-relaxed mb-3"
                  dangerouslySetInnerHTML={{
                    __html: para.replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

export default function Plan() {
  const [, setLocation] = useLocation();
  const { profile, clearProfile, isHydrated } = useTayoProfile();
  const [plan, setPlan] = useState<string | null>(null);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isNarrating, setIsNarrating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("tayo_plan");
    setPlan(stored);
  }, []);

  useEffect(() => {
    if (isHydrated && !profile) setLocation("/");
  }, [isHydrated, profile, setLocation]);

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
      const planSummary = plan.slice(0, 800);
      const audio = await speakText(
        `Here is ${profile?.firstName}'s strategic life plan. ${planSummary}`
      );
      audioRef.current = audio;
      audio.play();
      audio.onended = () => { setIsNarrating(false); setOrbState("idle"); };
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
  const planTitle = `${profile.firstName}'s ${year} Life Strategic Plan`;

  return (
    <StepLayout step={4} title="Your Strategic Plan">
      <div className="max-w-2xl mx-auto space-y-6 pb-16">

        {/* Plan Document */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-warm overflow-hidden"
        >
          {/* Document Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">
                Personal Strategic Plan
              </p>
              <h2 className="text-xl font-display text-foreground">
                {planTitle}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <VoiceOrb
                state={orbState}
                size={36}
                onClick={plan ? handleToggleNarration : undefined}
                disabled={!plan}
              />
              <button
                onClick={handleToggleNarration}
                disabled={!plan}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {isNarrating ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {isNarrating ? "Stop" : "Listen"}
              </button>
            </div>
          </div>

          {/* Plan Body */}
          <div className="px-6 py-5">
            {!plan ? (
              <div className="space-y-2 animate-pulse py-8">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 rounded bg-foreground/8" style={{ width: `${75 + Math.random() * 25}%` }} />
                ))}
              </div>
            ) : (
              formatPlan(plan, profile.firstName)
            )}
          </div>
        </motion.div>

        {/* Values reminder */}
        {profile.values?.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="card-warm p-4"
          >
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

        {/* Start Over */}
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
