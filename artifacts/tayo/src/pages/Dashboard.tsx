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

type Tab = "journey" | "who" | "next";

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

// Pyramid segment fill: warm brown palette per spec
function thrivingColor(thriving: number): string {
  if (thriving >= 7) return "#C4622D";    // high — burnt sienna
  if (thriving >= 4) return "#A85C3A";    // medium — warm umber
  return "#6B3520";                        // low — deep mahogany
}

// ─── 3-Tier SVG Pyramid with per-dimension subdivision ───────────────────────
function WellnessPyramid({ dimensions }: { dimensions: TayoDimension[] }) {
  const W = 340;
  const H = 320;
  const cx = W / 2;
  const apexY = 10;
  const baseY = H - 4;

  // Split dimensions by tier
  const meaningDims = dimensions.filter(d => d.tier === "meaning");
  const growthDims = dimensions.filter(d => d.tier === "growth");
  const foundDims = dimensions.filter(d => d.tier === "foundational");

  // 3 equal tier y-boundaries
  const totalH = baseY - apexY;
  const tierH = totalH / 3;
  const tierY = [apexY, apexY + tierH, apexY + 2 * tierH, baseY];

  // Half-width at a given y on the pyramid
  function halfW(y: number): number {
    return ((y - apexY) / (baseY - apexY)) * (W / 2 - 6);
  }

  // Subdivide one tier into equal trapezoid segments (one per dimension)
  function makeTierSegments(dims: TayoDimension[], y1: number, y2: number) {
    if (dims.length === 0) {
      const hw1 = halfW(y1);
      const hw2 = halfW(y2);
      const pts = y1 <= apexY + 1
        ? `${cx},${apexY} ${cx + hw2},${y2} ${cx - hw2},${y2}`
        : `${cx - hw1},${y1} ${cx + hw1},${y1} ${cx + hw2},${y2} ${cx - hw2},${y2}`;
      return [{ dim: null as TayoDimension | null, pts, midY: (y1 + y2) / 2, sy2: y2, hw2 }];
    }
    const segH = (y2 - y1) / dims.length;
    return dims.map((dim, i) => {
      const sy1 = y1 + i * segH;
      const sy2 = y1 + (i + 1) * segH;
      const hw1 = halfW(sy1);
      const hw2 = halfW(sy2);
      const midY = (sy1 + sy2) / 2;
      const pts = sy1 <= apexY + 1
        ? `${cx},${apexY} ${cx + hw2},${sy2} ${cx - hw2},${sy2}`
        : `${cx - hw1},${sy1} ${cx + hw1},${sy1} ${cx + hw2},${sy2} ${cx - hw2},${sy2}`;
      return { dim: dim as TayoDimension | null, pts, midY, sy2, hw2 };
    });
  }

  const allSegs = [
    ...makeTierSegments(meaningDims, tierY[0], tierY[1]),
    ...makeTierSegments(growthDims, tierY[1], tierY[2]),
    ...makeTierSegments(foundDims, tierY[2], tierY[3]),
  ];

  // Tier divider line y-values and right-edge label positions
  const tierMids = [(tierY[0] + tierY[1]) / 2, (tierY[1] + tierY[2]) / 2, (tierY[2] + tierY[3]) / 2];
  const TIER_LABELS = ["MEANING", "GROWTH", "FOUNDATIONAL"];

  return (
    <div className="w-full max-w-xs mx-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 320 }}>
        {/* Dimension segment polygons + labels */}
        {allSegs.map(({ dim, pts, midY }, idx) => (
          <g key={idx}>
            <polygon
              points={pts}
              fill={dim ? thrivingColor(dim.thriving) : "#8B6940"}
              stroke="#2C1810"
              strokeWidth="1"
            />
            {dim && (
              <>
                <text x={cx} y={midY - 3} textAnchor="middle" fontSize="11" fontWeight="700" fill="#F5F0E8" fontFamily="DM Sans, sans-serif">
                  {dim.name.length > 22 ? dim.name.slice(0, 20) + "…" : dim.name}
                </text>
                <text x={cx} y={midY + 10} textAnchor="middle" fontSize="9" fill="rgba(245,240,232,0.72)" fontFamily="DM Sans, sans-serif">
                  {dim.thriving}/10
                </text>
              </>
            )}
            {!dim && (
              <text x={cx} y={midY + 4} textAnchor="middle" fontSize="10" fill="rgba(245,240,232,0.4)" fontFamily="DM Sans, sans-serif" fontStyle="italic">—</text>
            )}
          </g>
        ))}

        {/* Tier boundary divider lines */}
        {[tierY[1], tierY[2]].map((y, i) => (
          <line key={i} x1={cx - halfW(y)} y1={y} x2={cx + halfW(y)} y2={y} stroke="#2C1810" strokeWidth="1.5" />
        ))}

        {/* Tier labels on right edge */}
        {tierMids.map((midY, i) => (
          <text key={i} x={cx + halfW(midY) + 5} y={midY + 4} fontSize="8" fill="rgba(44,24,16,0.5)" fontFamily="DM Sans, sans-serif" letterSpacing="0.5" fontWeight="600">
            {TIER_LABELS[i]}
          </text>
        ))}

        {/* Gold Self-Actualization apex tip */}
        <polygon
          points={`${cx},${apexY} ${cx - 14},${apexY + 22} ${cx + 14},${apexY + 22}`}
          fill="#D4A843"
          stroke="#2C1810"
          strokeWidth="1.5"
        />

        {/* Warm brown outer outline */}
        <polygon
          points={`${cx},${apexY} ${cx - halfW(baseY)},${baseY} ${cx + halfW(baseY)},${baseY}`}
          fill="none"
          stroke="#2C1810"
          strokeWidth="2.5"
        />
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-3">
        {[
          { label: "Thriving (7+)", color: "#C4622D" },
          { label: "Growing (4–6)", color: "#A85C3A" },
          { label: "Focus needed (<4)", color: "#6B3520" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
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
  const prefetchedAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isHydrated && !profile) setLocation("/");
  }, [isHydrated, profile, setLocation]);

  // Fetch narrative text then pre-fetch TTS audio (store Blob URL, do NOT auto-play)
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
        const narrativeText = data.narrative as string;
        setNarrative(narrativeText);

        // Pre-fetch TTS so it's instant on first Play click — do NOT auto-play
        speakText(narrativeText)
          .then(audio => { prefetchedAudioRef.current = audio; })
          .catch(() => { /* prefetch failed — will fetch on demand */ });
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
      const audio = prefetchedAudioRef.current ?? await speakText(narrative);
      prefetchedAudioRef.current = null;
      audioRef.current = audio;
      audio.play();
      audio.onended = () => { setIsNarrativePlaying(false); setOrbState("idle"); };
      audio.onerror = () => { setIsNarrativePlaying(false); setOrbState("idle"); };
    } catch {
      setIsNarrativePlaying(false);
      setOrbState("idle");
    }
  }, [narrative, isNarrativePlaying]);

  if (!isHydrated || !profile) return null;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "journey", label: "Journey to Date" },
    { id: "who", label: "Who You Are Now" },
    { id: "next", label: "Where to Journey Next" },
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
          {/* Tab 1: Journey to Date — sage line, burnt orange dots */}
          {activeTab === "journey" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-base text-foreground mb-4 text-center">
                Journey to Date
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
                        stroke="#638863"
                        strokeWidth={2.5}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          return (
                            <Dot
                              key={`dot-${payload.approximateYear}`}
                              cx={cx}
                              cy={cy}
                              r={5}
                              fill="#C4622D"
                              stroke="#F5F0E8"
                              strokeWidth={2}
                            />
                          );
                        }}
                        activeDot={{ r: 7, fill: "#C4622D" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-center text-xs text-muted-foreground mt-1 mb-3 italic">
                    Toward your full potential
                  </p>

                  <div className="flex flex-wrap justify-center gap-2">
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

          {/* Tab 2: Who You Are Now — SVG pyramid */}
          {activeTab === "who" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-base text-foreground mb-6 text-center">
                Who You Are Now
              </h3>
              <WellnessPyramid dimensions={profile.dimensions} />
            </div>
          )}

          {/* Tab 3: Where to Journey Next — 2x2 quadrant */}
          {activeTab === "next" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-base text-foreground mb-6 text-center">
                Where to Journey Next
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
            Continue to Coach
          </button>
        </div>
      </div>
    </StepLayout>
  );
}
