import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile, type TayoDimension } from "@/hooks/use-tayo-state";
import { cn } from "@/lib/utils";
import { MessageSquare, Volume2, VolumeX } from "lucide-react";

type Tab = "journey" | "pyramid" | "focus";

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

// Wellness Pyramid Component
function WellnessPyramid({ dimensions }: { dimensions: TayoDimension[] }) {
  const byTier = {
    meaning: dimensions.filter(d => d.tier === "meaning"),
    growth: dimensions.filter(d => d.tier === "growth"),
    foundational: dimensions.filter(d => d.tier === "foundational"),
  };

  const TIER_COLORS = {
    meaning: { bg: "#E07020", text: "white", label: "Meaning & Purpose" },
    growth: { bg: "#D4A024", text: "white", label: "Growth & Connection" },
    foundational: { bg: "#638863", text: "white", label: "Foundational Wellbeing" },
  };

  const tiers: Array<keyof typeof byTier> = ["meaning", "growth", "foundational"];

  return (
    <div className="w-full max-w-lg mx-auto space-y-1">
      {tiers.map((tier, i) => {
        const dims = byTier[tier];
        const { bg, text, label } = TIER_COLORS[tier];
        const widthPct = tier === "meaning" ? 55 : tier === "growth" ? 75 : 100;

        return (
          <motion.div
            key={tier}
            initial={{ opacity: 0, scaleX: 0.8 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: (2 - i) * 0.15 }}
            className="mx-auto"
            style={{ width: `${widthPct}%` }}
          >
            <div
              className="rounded-lg p-4 text-center"
              style={{ backgroundColor: bg }}
            >
              <p className="text-xs font-semibold mb-2 opacity-80 uppercase tracking-wider" style={{ color: text }}>
                {label}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {dims.length === 0 ? (
                  <span className="text-xs opacity-60" style={{ color: text }}>No dimensions assigned</span>
                ) : (
                  dims.map(d => (
                    <div key={d.name} className="text-center">
                      <div
                        className="px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: "rgba(255,255,255,0.2)", color: text }}
                      >
                        {d.name}
                      </div>
                      <div className="mt-1 text-xs opacity-70" style={{ color: text }}>
                        {d.thriving}/10
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
      <div className="w-0 h-0 mx-auto"
        style={{
          borderLeft: "20px solid transparent",
          borderRight: "20px solid transparent",
          borderTop: "16px solid #638863",
        }}
      />
    </div>
  );
}

// Focus Quadrant
function FocusQuadrant({ dimensions }: { dimensions: TayoDimension[] }) {
  const QUAD_COLORS: Record<string, string> = {
    "Leverage": "#638863",
    "Invest Now": "#E07020",
    "Monitor": "#D4A024",
    "Maintain": "#8B6940",
  };

  const getQuadrant = (d: TayoDimension) => {
    const highImp = d.importance >= 6;
    const highThr = d.thriving >= 6;
    if (highImp && highThr) return "Leverage";
    if (highImp && !highThr) return "Invest Now";
    if (!highImp && highThr) return "Maintain";
    return "Monitor";
  };

  const quadrants = ["Invest Now", "Leverage", "Monitor", "Maintain"];

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="grid grid-cols-2 gap-3">
        {quadrants.map((q) => {
          const dims = dimensions.filter(d => getQuadrant(d) === q);
          const color = QUAD_COLORS[q];
          return (
            <motion.div
              key={q}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-warm p-4 min-h-28"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{q}</span>
              </div>
              <div className="space-y-1.5">
                {dims.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 italic">None</p>
                ) : (
                  dims.map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{d.thriving}/10</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground px-2">
        <span>← Low Importance</span>
        <span>High Importance →</span>
      </div>
    </div>
  );
}

// Custom tooltip for line chart
function JourneyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card-warm px-3 py-2 text-xs max-w-48">
      <p className="font-semibold text-foreground">{d.chapterName}</p>
      <p className="text-muted-foreground">{d.label} · {d.approximateYear}</p>
      <p className="text-primary font-medium mt-1">Actualization: {d.actualizationLevel}%</p>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { profile, isHydrated } = useTayoProfile();
  const [activeTab, setActiveTab] = useState<Tab>("journey");
  const [narrative, setNarrative] = useState<string | null>(null);
  const [isFetchingNarrative, setIsFetchingNarrative] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isNarrativePlaying, setIsNarrativePlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isHydrated && !profile) {
      setLocation("/");
    }
  }, [isHydrated, profile, setLocation]);

  // Fetch narrative on mount
  useEffect(() => {
    if (!profile || narrative) return;
    const fetchNarrative = async () => {
      setIsFetchingNarrative(true);
      try {
        const res = await fetch(`${BASE_URL}/api/narrative`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile }),
        });
        const data = await res.json();
        setNarrative(data.narrative);
      } catch {
        setNarrative(profile.overallNarrative || null);
      } finally {
        setIsFetchingNarrative(false);
      }
    };
    fetchNarrative();
  }, [profile]);

  const handlePlayNarrative = useCallback(async () => {
    if (!narrative) return;
    if (isNarrativePlaying) {
      audioRef.current?.pause();
      audioRef.current = null;
      setIsNarrativePlaying(false);
      setOrbState("idle");
      return;
    }
    setOrbState("speaking");
    setIsNarrativePlaying(true);
    try {
      const audio = await speakText(narrative);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => {
        setIsNarrativePlaying(false);
        setOrbState("idle");
      };
    } catch {
      setIsNarrativePlaying(false);
      setOrbState("idle");
    }
  }, [narrative, isNarrativePlaying]);

  if (!isHydrated || !profile) return null;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "journey", label: "Life Journey" },
    { id: "pyramid", label: "Wellness Pyramid" },
    { id: "focus", label: "Focus Quadrant" },
  ];

  const sortedEvents = [...(profile.lifeEvents || [])].sort((a, b) => a.approximateYear - b.approximateYear);

  return (
    <StepLayout step={2} title={`${profile.firstName}'s Dashboard`}>
      <div className="space-y-8">

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground hover:border-foreground/20"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {/* Life Journey - Line Chart */}
          {activeTab === "journey" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-lg text-foreground mb-6 text-center">
                Your Actualization Journey
              </h3>
              {sortedEvents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No life events extracted.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={sortedEvents} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(46,36,25,0.08)" />
                    <XAxis
                      dataKey="approximateYear"
                      tick={{ fontSize: 11, fill: "#746A5A" }}
                      angle={-30}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "#746A5A" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<JourneyTooltip />} />
                    <ReferenceLine y={50} stroke="rgba(46,36,25,0.15)" strokeDasharray="4 4" />
                    <Line
                      type="monotone"
                      dataKey="actualizationLevel"
                      stroke="#E07020"
                      strokeWidth={3}
                      dot={{ fill: "#E07020", r: 5, strokeWidth: 2, stroke: "#F5F0E8" }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {sortedEvents.map((evt, i) => (
                  <div key={i} className="text-center px-3 py-2 rounded-lg bg-background/60 text-xs">
                    <p className="font-semibold text-foreground">{evt.chapterName}</p>
                    <p className="text-muted-foreground">{evt.approximateYear}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wellness Pyramid */}
          {activeTab === "pyramid" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-lg text-foreground mb-6 text-center">
                Your Wellness Pyramid
              </h3>
              <WellnessPyramid dimensions={profile.dimensions} />
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {(["meaning", "growth", "foundational"] as const).map(tier => (
                  <div key={tier} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      tier === "meaning" ? "bg-primary" :
                      tier === "growth" ? "bg-accent" : "bg-sage"
                    )} style={{
                      backgroundColor: tier === "meaning" ? "#E07020" : tier === "growth" ? "#D4A024" : "#638863"
                    }} />
                    <span className="capitalize">{tier}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Focus Quadrant */}
          {activeTab === "focus" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-lg text-foreground mb-6 text-center">
                Where to Focus
              </h3>
              <FocusQuadrant dimensions={profile.dimensions} />
            </div>
          )}
        </motion.div>

        {/* Narrative Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card-warm p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg text-foreground">Your Narrative</h3>
            <div className="flex items-center gap-3">
              <VoiceOrb
                state={orbState}
                size={40}
                onClick={narrative ? handlePlayNarrative : undefined}
                disabled={!narrative || isFetchingNarrative}
              />
              <button
                onClick={handlePlayNarrative}
                disabled={!narrative || isFetchingNarrative}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors",
                  isNarrativePlaying ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isNarrativePlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {isNarrativePlaying ? "Stop" : "Listen"}
              </button>
            </div>
          </div>

          {isFetchingNarrative ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 rounded bg-foreground/8 w-full" />
              <div className="h-4 rounded bg-foreground/8 w-10/12" />
              <div className="h-4 rounded bg-foreground/8 w-11/12" />
              <div className="h-4 rounded bg-foreground/8 w-9/12" />
            </div>
          ) : narrative ? (
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
              {narrative}
            </p>
          ) : (
            <p className="text-muted-foreground italic text-sm">Narrative not available.</p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {(profile.values || []).slice(0, 5).map((v, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-xs font-medium text-foreground border border-border bg-background/40"
              >
                {v}
              </span>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <div className="flex justify-center pb-8">
          <button
            onClick={() => setLocation("/chat")}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 hover:scale-105 transition-all shadow-lg"
          >
            <MessageSquare className="w-4 h-4" />
            Start Coaching Session
          </button>
        </div>

      </div>
    </StepLayout>
  );
}
