import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, Tooltip, ResponsiveContainer, Dot
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

// Color based on thriving score
function thrivingColor(thriving: number): string {
  if (thriving >= 7) return "#638863";    // sage green
  if (thriving >= 4) return "#D4A024";    // gold
  return "#E07020";                        // orange/warm
}

// ─── Proper SVG Pyramid ───────────────────────────────────────────────────────
function WellnessPyramid({ dimensions }: { dimensions: TayoDimension[] }) {
  const W = 340;
  const H = 320;
  const cx = W / 2;

  // Pyramid apex and base
  const apex = { x: cx, y: 6 };
  const baseLeft = { x: 4, y: H - 4 };
  const baseRight = { x: W - 4, y: H - 4 };

  // Tier dividers at y=115 and y=215 (roughly 1/3 each)
  const tier1Y = 115;   // meaning top boundary
  const tier2Y = 215;   // growth top boundary

  // Compute x edges at a given y on the pyramid triangle
  function edgeX(y: number): { left: number; right: number } {
    const t = (y - apex.y) / (baseLeft.y - apex.y);
    const left = apex.x + t * (baseLeft.x - apex.x);
    const right = apex.x + t * (baseRight.x - apex.x);
    return { left, right };
  }

  const t1 = edgeX(tier1Y);
  const t2 = edgeX(tier2Y);

  // Tier polygons
  const meaningPts = `${apex.x},${apex.y} ${t1.right},${tier1Y} ${t1.left},${tier1Y}`;
  const growthPts = `${t1.left},${tier1Y} ${t1.right},${tier1Y} ${t2.right},${tier2Y} ${t2.left},${tier2Y}`;
  const foundPts = `${t2.left},${tier2Y} ${t2.right},${tier2Y} ${baseRight.x},${baseLeft.y} ${baseLeft.x},${baseLeft.y}`;

  const byTier = {
    meaning: dimensions.filter(d => d.tier === "meaning"),
    growth: dimensions.filter(d => d.tier === "growth"),
    foundational: dimensions.filter(d => d.tier === "foundational"),
  };

  // Tier label positions
  const meaningMidY = (apex.y + tier1Y) / 2 + 2;
  const growthMidY = (tier1Y + tier2Y) / 2;
  const foundMidY = (tier2Y + H) / 2 - 4;

  function renderDimLabels(
    dims: TayoDimension[],
    midY: number,
    availWidth: number
  ) {
    if (dims.length === 0) return null;
    const lineHeight = 16;
    const startY = midY - ((dims.length - 1) * lineHeight) / 2;
    return dims.map((d, i) => (
      <g key={d.name}>
        <text
          x={cx}
          y={startY + i * lineHeight + 4}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill={thrivingColor(d.thriving)}
          fontFamily="DM Sans, sans-serif"
        >
          {d.name}
        </text>
        <text
          x={cx}
          y={startY + i * lineHeight + 14}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(255,255,255,0.7)"
          fontFamily="DM Sans, sans-serif"
        >
          {d.thriving}/10
        </text>
      </g>
    ));
  }

  // Available widths at midpoints
  const meaningAvgY = (apex.y + tier1Y) / 2;
  const growthAvgY = (tier1Y + tier2Y) / 2;
  const foundAvgY = (tier2Y + H) / 2;

  return (
    <div className="w-full max-w-xs mx-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 320 }}>
        {/* Tier fills */}
        <polygon points={foundPts} fill="#638863" stroke="#5C4A30" strokeWidth="2" />
        <polygon points={growthPts} fill="#D4A024" stroke="#5C4A30" strokeWidth="2" />
        <polygon points={meaningPts} fill="#E07020" stroke="#5C4A30" strokeWidth="2" />

        {/* Gold apex tip highlight */}
        <polygon
          points={`${cx},${apex.y} ${cx - 18},${apex.y + 32} ${cx + 18},${apex.y + 32}`}
          fill="#F0C040"
          stroke="#5C4A30"
          strokeWidth="1.5"
        />

        {/* Tier divider lines */}
        <line x1={t1.left} y1={tier1Y} x2={t1.right} y2={tier1Y} stroke="#5C4A30" strokeWidth="1.5" />
        <line x1={t2.left} y1={tier2Y} x2={t2.right} y2={tier2Y} stroke="#5C4A30" strokeWidth="1.5" />

        {/* Tier label text */}
        <text x={cx} y={tier1Y - 5} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.6)" fontFamily="DM Sans, sans-serif" letterSpacing="1">
          MEANING
        </text>
        <text x={cx} y={tier2Y - 5} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.6)" fontFamily="DM Sans, sans-serif" letterSpacing="1">
          GROWTH
        </text>
        <text x={cx} y={H - 8} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.6)" fontFamily="DM Sans, sans-serif" letterSpacing="1">
          FOUNDATIONAL
        </text>

        {/* Dimension labels in each tier */}
        {renderDimLabels(byTier.meaning, meaningMidY, edgeX(meaningAvgY).right - edgeX(meaningAvgY).left)}
        {renderDimLabels(byTier.growth, growthMidY, edgeX(growthAvgY).right - edgeX(growthAvgY).left)}
        {renderDimLabels(byTier.foundational, foundMidY, edgeX(foundAvgY).right - edgeX(foundAvgY).left)}
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-3">
        {[
          { label: "Thriving (7+)", color: "#638863" },
          { label: "Developing (4-6)", color: "#D4A024" },
          { label: "Needs focus (<4)", color: "#E07020" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Focus Quadrant ───────────────────────────────────────────────────────────
function FocusQuadrant({ dimensions }: { dimensions: TayoDimension[] }) {
  const getQuadrant = (d: TayoDimension) => {
    const highImp = d.importance >= 6;
    const highThr = d.thriving >= 6;
    if (highImp && highThr) return "Leverage";
    if (highImp && !highThr) return "Invest Now";
    if (!highImp && highThr) return "Maintain";
    return "Monitor";
  };

  const QUAD_COLORS: Record<string, string> = {
    "Leverage": "#638863",
    "Invest Now": "#E07020",
    "Monitor": "#D4A024",
    "Maintain": "#8B6940",
  };

  const quadrants = ["Invest Now", "Leverage", "Monitor", "Maintain"] as const;

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="grid grid-cols-2 gap-3">
        {quadrants.map((q) => {
          const dims = dimensions.filter(d => getQuadrant(d) === q);
          return (
            <motion.div
              key={q}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-warm p-4 min-h-28"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: QUAD_COLORS[q] }} />
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

// ─── Journey Tooltip ──────────────────────────────────────────────────────────
function JourneyTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; chapterName: string; approximateYear: number; actualizationLevel: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card-warm px-3 py-2 text-xs max-w-48 shadow-lg">
      <p className="font-semibold text-foreground">{d.chapterName}</p>
      <p className="text-muted-foreground">{d.label} · {d.approximateYear}</p>
      <p className="font-medium mt-1" style={{ color: thrivingColor(Math.round(d.actualizationLevel / 10)) }}>
        {d.actualizationLevel}% actualized
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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
    if (isHydrated && !profile) setLocation("/");
  }, [isHydrated, profile, setLocation]);

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
        setNarrative(data.narrative as string);
      } catch {
        setNarrative(profile.overallNarrative ?? null);
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
      audio.onended = () => { setIsNarrativePlaying(false); setOrbState("idle"); };
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

  const sortedEvents = [...(profile.lifeEvents ?? [])].sort((a, b) => a.approximateYear - b.approximateYear);

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
          {/* Life Journey — clean line chart, no grid */}
          {activeTab === "journey" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-base text-foreground mb-4 text-center">
                Your Actualization Journey
              </h3>
              {sortedEvents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No life events to display.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={sortedEvents} margin={{ top: 16, right: 24, left: 4, bottom: 16 }}>
                      <XAxis
                        dataKey="approximateYear"
                        tick={{ fontSize: 11, fill: "#746A5A" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<JourneyTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="actualizationLevel"
                        stroke="#E07020"
                        strokeWidth={3}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          return (
                            <Dot
                              key={`dot-${payload.approximateYear}`}
                              cx={cx}
                              cy={cy}
                              r={5}
                              fill={thrivingColor(Math.round(payload.actualizationLevel / 10))}
                              stroke="#F5F0E8"
                              strokeWidth={2}
                            />
                          );
                        }}
                        activeDot={{ r: 7, fill: "#E07020" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {sortedEvents.map((evt, i) => (
                      <div key={i} className="text-center px-2 py-1.5 rounded-lg bg-background/60 text-xs">
                        <p className="font-semibold text-foreground">{evt.chapterName}</p>
                        <p className="text-muted-foreground">{evt.approximateYear}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Wellness Pyramid */}
          {activeTab === "pyramid" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-base text-foreground mb-6 text-center">
                Your Wellness Pyramid
              </h3>
              <WellnessPyramid dimensions={profile.dimensions} />
            </div>
          )}

          {/* Focus Quadrant */}
          {activeTab === "focus" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-base text-foreground mb-6 text-center">
                Where to Focus
              </h3>
              <FocusQuadrant dimensions={profile.dimensions} />
            </div>
          )}
        </motion.div>

        {/* Narrative Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card-warm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base text-foreground">Your Narrative</h3>
            <div className="flex items-center gap-2">
              <VoiceOrb
                state={orbState}
                size={36}
                onClick={narrative ? handlePlayNarrative : undefined}
                disabled={!narrative || isFetchingNarrative}
              />
              <button
                onClick={handlePlayNarrative}
                disabled={!narrative || isFetchingNarrative}
                className={cn(
                  "flex items-center gap-1 text-xs font-medium transition-colors",
                  isNarrativePlaying ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isNarrativePlaying ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {isNarrativePlaying ? "Stop" : "Listen"}
              </button>
            </div>
          </div>

          {isFetchingNarrative ? (
            <div className="space-y-2 animate-pulse">
              {[100, 92, 96, 85].map((w, i) => (
                <div key={i} className="h-4 rounded bg-foreground/8" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : narrative ? (
            <p className="text-muted-foreground leading-relaxed text-sm">{narrative}</p>
          ) : (
            <p className="text-muted-foreground italic text-sm">Narrative unavailable.</p>
          )}

          {(profile.values ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {profile.values.slice(0, 5).map((v, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-xs font-medium text-foreground border border-border bg-background/40">
                  {v}
                </span>
              ))}
            </div>
          )}
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
