import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot, LabelList,
  ComposedChart, Bar, Cell,
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

// Fixed distinct palette — one colour per dimension slot (not thriving-based)
const DIM_PALETTE = [
  "#C4622D", // terracotta
  "#7A9E87", // sage
  "#D4A843", // gold
  "#8B5A2B", // warm umber
  "#5B7FA6", // slate blue
  "#A3623E", // sienna
  "#6B8E6B", // forest green
  "#C08050", // caramel
];

function dimColor(index: number): string {
  return DIM_PALETTE[index % DIM_PALETTE.length];
}

// ─── SVG Wellness Pyramid ─────────────────────────────────────────────────────
function WellnessPyramid({ dimensions }: { dimensions: TayoDimension[] }) {
  const W = 380;
  const H = 400;
  const cx = W / 2;
  const apexY = 12;
  const baseY = H - 60; // leave room for legend

  const meaningDims = dimensions.filter(d => d.tier === "meaning");
  const growthDims = dimensions.filter(d => d.tier === "growth");
  const foundDims = dimensions.filter(d => d.tier === "foundational");

  const totalH = baseY - apexY;
  const tierH = totalH / 3;
  const tierY = [apexY, apexY + tierH, apexY + 2 * tierH, baseY];

  function halfW(y: number): number {
    return ((y - apexY) / (baseY - apexY)) * (W / 2 - 8);
  }

  // Assign a stable per-dimension colour by global position
  const dimColorMap = new Map<string, string>();
  dimensions.forEach((d, i) => dimColorMap.set(d.name, dimColor(i)));

  function makeTierSegments(dims: TayoDimension[], y1: number, y2: number) {
    if (dims.length === 0) {
      const hw1 = halfW(y1);
      const hw2 = halfW(y2);
      const pts = y1 <= apexY + 1
        ? `${cx},${apexY} ${cx + hw2},${y2} ${cx - hw2},${y2}`
        : `${cx - hw1},${y1} ${cx + hw1},${y1} ${cx + hw2},${y2} ${cx - hw2},${y2}`;
      return [{ dim: null as TayoDimension | null, pts, midY: (y1 + y2) / 2, hw2 }];
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
      return { dim: dim as TayoDimension | null, pts, midY, hw2 };
    });
  }

  const allSegs = [
    ...makeTierSegments(meaningDims, tierY[0], tierY[1]),
    ...makeTierSegments(growthDims, tierY[1], tierY[2]),
    ...makeTierSegments(foundDims, tierY[2], tierY[3]),
  ];

  const tierMids = [(tierY[0] + tierY[1]) / 2, (tierY[1] + tierY[2]) / 2, (tierY[2] + tierY[3]) / 2];
  const TIER_LABELS = ["MEANING", "GROWTH", "FOUNDATIONAL"];

  // Dims that have a legendDescription to show in the legend below
  const legendDims = dimensions.filter(d => d.roleDescriptor || d.legendDescription);

  return (
    <div className="w-full max-w-sm mx-auto">
      <svg viewBox={`0 0 ${W} ${baseY + 10}`} width="100%" style={{ maxWidth: 380 }}>
        {/* Dimension polygons + name + roleDescriptor */}
        {allSegs.map(({ dim, pts, midY }, idx) => {
          const fill = dim ? (dimColorMap.get(dim.name) ?? "#8B6940") : "#8B6940";
          return (
            <g key={idx}>
              <polygon points={pts} fill={fill} stroke="#2C1810" strokeWidth="1" />
              {dim && (
                <>
                  <text x={cx} y={midY - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#F5F0E8" fontFamily="DM Sans, sans-serif">
                    {dim.name.length > 20 ? dim.name.slice(0, 18) + "…" : dim.name}
                  </text>
                  {dim.roleDescriptor && (
                    <text x={cx} y={midY + 9} textAnchor="middle" fontSize="9" fill="rgba(245,240,232,0.78)" fontFamily="DM Sans, sans-serif" fontStyle="italic">
                      {dim.roleDescriptor}
                    </text>
                  )}
                </>
              )}
              {!dim && (
                <text x={cx} y={midY + 4} textAnchor="middle" fontSize="10" fill="rgba(245,240,232,0.4)" fontFamily="DM Sans, sans-serif" fontStyle="italic">—</text>
              )}
            </g>
          );
        })}

        {/* Tier divider lines */}
        {[tierY[1], tierY[2]].map((y, i) => (
          <line key={i} x1={cx - halfW(y)} y1={y} x2={cx + halfW(y)} y2={y} stroke="#2C1810" strokeWidth="1.5" />
        ))}

        {/* Tier labels (right edge) */}
        {tierMids.map((midY, i) => (
          <text key={i} x={cx + halfW(midY) + 5} y={midY + 4} fontSize="8" fill="rgba(44,24,16,0.45)" fontFamily="DM Sans, sans-serif" letterSpacing="0.5" fontWeight="600">
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

        {/* Outer border */}
        <polygon
          points={`${cx},${apexY} ${cx - halfW(baseY)},${baseY} ${cx + halfW(baseY)},${baseY}`}
          fill="none"
          stroke="#2C1810"
          strokeWidth="2.5"
        />
      </svg>

      {/* Per-dimension legend with legendDescription */}
      {legendDims.length > 0 && (
        <div className="mt-4 space-y-2">
          {legendDims.map((d) => (
            <div key={d.name} className="flex gap-2 items-start">
              <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: dimColorMap.get(d.name) ?? "#8B6940" }} />
              <div>
                <span className="text-xs font-semibold text-foreground">{d.name}</span>
                {d.roleDescriptor && (
                  <span className="text-xs text-primary ml-1.5 italic">{d.roleDescriptor}</span>
                )}
                {d.legendDescription && (
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{d.legendDescription}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Thrive Gap Bar Chart ─────────────────────────────────────────────────────
function ThriveGapChart({ dimensions }: { dimensions: TayoDimension[] }) {
  // Sort by importance ascending (left = least important)
  const sorted = [...dimensions].sort((a, b) => a.importance - b.importance);

  function barColor(d: TayoDimension): string {
    const gap = d.importance - d.thriving;
    if (gap >= 3) return "#C4622D";   // large gap — terracotta (invest now)
    if (gap <= -2) return "#D4A843";  // thriving exceeds importance — gold (leverage)
    return "#7A9E87";                 // balanced — sage
  }

  const chartData = sorted.map(d => ({
    name: d.name.length > 14 ? d.name.slice(0, 13) + "…" : d.name,
    fullName: d.name,
    thriving: d.thriving,
    importance: d.importance,
    color: barColor(d),
  }));

  return (
    <div className="w-full max-w-lg mx-auto">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 60 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#746A5A", fontFamily: "DM Sans, sans-serif" }}
            axisLine={false}
            tickLine={false}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 10, fill: "#746A5A" }}
            axisLine={false}
            tickLine={false}
            width={24}
            label={{ value: "Score / 10", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 9, fill: "#9B8E84" } }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              const gap = d.importance - d.thriving;
              return (
                <div className="card-warm px-3 py-2.5 text-xs shadow-lg min-w-36">
                  <p className="font-semibold text-foreground mb-1">{d.fullName}</p>
                  <p style={{ color: "#7A9E87" }}>Thriving: <span className="font-semibold">{d.thriving}/10</span></p>
                  <p style={{ color: "#C4622D" }}>Importance: <span className="font-semibold">{d.importance}/10</span></p>
                  {gap > 0 && <p className="text-muted-foreground mt-1">Gap: {gap} points — invest here</p>}
                  {gap < 0 && <p className="text-muted-foreground mt-1">Thriving: leverage this strength</p>}
                </div>
              );
            }}
          />
          {/* Thriving bars — custom shape draws bar + scoped importance dashed line */}
          <Bar
            dataKey="thriving"
            maxBarSize={40}
            shape={(props: Record<string, unknown>) => {
              const x = props.x as number;
              const y = props.y as number;
              const width = props.width as number;
              const height = props.height as number;
              const fill = props.fill as string;
              const bg = props.background as { y: number; height: number };
              const payload = props.payload as { importance: number };

              if (!width || width <= 0) return <g />;

              // Convert importance value → SVG y-coordinate
              // bg.y = top of chart area (domain max), bg.y+bg.height = bottom (domain 0)
              const importanceY = bg.y + bg.height * (1 - payload.importance / 10);

              return (
                <g>
                  {/* Bar with rounded top corners */}
                  <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} ry={4} />
                  {/* Dashed importance line — exactly bar width, positioned at importance level */}
                  <line
                    x1={x}
                    y1={importanceY}
                    x2={x + width}
                    y2={importanceY}
                    stroke="#C4622D"
                    strokeDasharray="5 3"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </g>
              );
            }}
          >
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-2">
        {[
          { color: "#C4622D", label: "Large gap — invest now" },
          { color: "#7A9E87", label: "Balanced" },
          { color: "#D4A843", label: "Thriving above target" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke="#C4622D" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
          <span>Importance</span>
        </div>
      </div>
    </div>
  );
}

// ─── Journey Tooltip ──────────────────────────────────────────────────────────
function JourneyTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; chapterName: string; approximateYear: number; actualizationLevel: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card-warm px-3 py-2 text-xs max-w-48 shadow-lg">
      <p className="font-semibold text-foreground">{d.chapterName}</p>
      <p className="text-muted-foreground">{d.label} · {d.approximateYear}</p>
      <p className="font-medium mt-1 text-primary">{d.actualizationLevel}% actualized</p>
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
        speakText(narrativeText)
          .then(audio => { prefetchedAudioRef.current = audio; })
          .catch(() => {});
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
    <StepLayout
      step={2}
      title={`${profile.firstName}'s Dashboard`}
      description="Your life mapped — three lenses to see yourself clearly: how far you've come, who you are across every dimension, and where to direct your energy next."
    >
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
          {/* Tab 1: Journey to Date — chapterName X-axis, labeled Y-axis */}
          {activeTab === "journey" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-base text-foreground mb-1 text-center">
                Your Journey
              </h3>
              <p className="text-xs text-center text-muted-foreground mb-4">Path to self-actualisation over time</p>
              {sortedEvents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No life events to display.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={sortedEvents} margin={{ top: 16, right: 28, left: 8, bottom: 70 }}>
                    <XAxis
                      dataKey="chapterName"
                      tick={{ fontSize: 10, fill: "#746A5A", fontFamily: "DM Sans, sans-serif" }}
                      axisLine={false}
                      tickLine={false}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      label={{
                        value: "Path to Self-Actualization",
                        angle: -90,
                        position: "insideLeft",
                        offset: 14,
                        style: { fontSize: 10, fill: "#9B8E84", fontFamily: "DM Sans, sans-serif" },
                      }}
                    />
                    <Tooltip content={<JourneyTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="actualizationLevel"
                      stroke="#7A9E87"
                      strokeWidth={3}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        return (
                          <Dot
                            key={`dot-${payload.approximateYear}`}
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill="#C4622D"
                            stroke="#F5F0E8"
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 8, fill: "#C4622D" }}
                    >
                      <LabelList
                        dataKey="label"
                        position="top"
                        offset={8}
                        style={{
                          fontSize: "9px",
                          fill: "#9B8E84",
                          fontFamily: "DM Sans, sans-serif",
                        }}
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Tab 2: Who You Are Now — SVG pyramid with distinct colors */}
          {activeTab === "who" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-base text-foreground mb-1 text-center">
                Who You Are Now
              </h3>
              <p className="text-xs text-center text-muted-foreground mb-5">Your life dimensions arranged by depth of meaning</p>
              <WellnessPyramid dimensions={profile.dimensions} />
            </div>
          )}

          {/* Tab 3: Where to Journey Next — thrive gap bar chart */}
          {activeTab === "next" && (
            <div className="card-warm p-6">
              <h3 className="font-display text-base text-foreground mb-1 text-center">
                Where to Journey Next
              </h3>
              <p className="text-xs text-center text-muted-foreground mb-5">Bars show thriving level · dashed line shows importance · colour shows the gap</p>
              <ThriveGapChart dimensions={profile.dimensions} />
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
