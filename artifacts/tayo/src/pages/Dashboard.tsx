import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile, type TayoDimension, type TayoLifeEvent } from "@/hooks/use-tayo-state";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo, DEMO_SNAPSHOT, DEMO_PROFILE } from "@/contexts/DemoContext";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, History, Lock, ChevronRight, Headphones } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
type Tab = "journey" | "portrait" | "scorecard";

interface Snapshot {
  id: string;
  snapshot_version: number;
  chapter_cards: TayoLifeEvent[];
  portrait_stats: TayoDimension[];
  scorecard: {
    purpose?: string;
    values?: string[];
    strengths?: string[];
    challenges?: string[];
    focusAreas?: string[];
  };
  narrative_blurb: string;
  created_at: string;
}

const MOOD_COLORS: Record<string, { bg: string; dot: string; label: string }> = {
  peak:          { bg: "rgba(122,158,135,0.15)", dot: "#7A9E87", label: "Breakthrough" },
  valley:        { bg: "rgba(196,98,45,0.1)",    dot: "#C4622D", label: "Challenging" },
  turning_point: { bg: "rgba(212,168,67,0.12)",  dot: "#D4A843", label: "Transitional" },
  stable:        { bg: "rgba(91,127,166,0.1)",   dot: "#5B7FA6", label: "Formative" },
};

// Portrait colors: dark forest green = Thriving, light green = Building, amber yellow = Needs Attention
function thriveColor(thriving: number) {
  if (thriving >= 7) return "#1B5E20";
  if (thriving >= 4) return "#81C784";
  return "#F9A825";
}
function thriveLabel(thriving: number) {
  if (thriving >= 7) return "Thriving";
  if (thriving >= 4) return "Building";
  return "Needs Attention";
}
function thriveWidth(thriving: number) {
  if (thriving >= 7) return "80%";
  if (thriving >= 4) return "50%";
  return "25%";
}

// Strip quantitative scores/numbers from narrative text
function stripNumbers(text: string): string {
  return text
    .replace(/\b\d+\s*(?:out of|\/)\s*\d+\b/gi, "")
    .replace(/\bsits?\s+at\s+(?:only\s+)?(?:a\s+)?\d+/gi, "")
    .replace(/\bscores?\s+(?:a\s+)?\d+/gi, "")
    .replace(/\b\d+%\b/g, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:points?)\b/gi, "")
    .replace(/\(\s*\d+\s*(?:\/\d+)?\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Tab A: Chapter Cards (horizontal scroll) ─────────────────────────────────
function ChapterCards({ events }: { events: TayoLifeEvent[] }) {
  const sorted = [...events].sort((a, b) => a.approximateYear - b.approximateYear);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
        <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>Your journey will appear here after your first session.</p>
        <p className="text-xs" style={{ color: "#9B8E84" }}>Complete the voice intake to build your chapter map.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(44,24,16,0.2) transparent" }}>
      <div className="flex gap-0 min-w-max items-start px-1">
        {sorted.map((ev, i) => {
          const mood = MOOD_COLORS[ev.type] ?? MOOD_COLORS.stable;
          const isLast = i === sorted.length - 1;
          return (
            <div key={i} className="flex items-start">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl p-5 flex-shrink-0 w-52"
                style={{ backgroundColor: isLast ? "rgba(196,98,45,0.08)" : mood.bg, border: `1.5px solid ${isLast ? "#C4622D" : mood.dot}30` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: isLast ? "#C4622D" : mood.dot }} />
                  <span className="text-xs font-semibold" style={{ color: isLast ? "#C4622D" : mood.dot }}>
                    {isLast ? "Right now" : mood.label}
                  </span>
                </div>
                <h4 className="font-display text-sm font-semibold mb-1 leading-snug" style={{ color: "#2C1810" }}>{ev.chapterName}</h4>
                <p className="text-xs mb-2" style={{ color: "#9B8E84" }}>{ev.label}</p>
                {ev.approximateYear && (
                  <p className="text-xs" style={{ color: "#9B8E84" }}>~{ev.approximateYear}</p>
                )}
              </motion.div>
              {i < sorted.length - 1 && (
                <div className="flex items-center self-center">
                  <div style={{ width: 20, height: 1, backgroundColor: "rgba(44,24,16,0.2)" }} />
                  <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(44,24,16,0.3)", marginLeft: -4 }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab B: Portrait Stats ────────────────────────────────────────────────────
function PortraitStats({ dimensions }: { dimensions: TayoDimension[] }) {
  if (dimensions.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
        <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>Not yet explored</p>
        <p className="text-xs" style={{ color: "#9B8E84" }}>Complete the voice intake to see who you are across each life dimension.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm mb-6" style={{ color: "#746A5A" }}>
        How you're progressing across the dimensions that shape a meaningful life.
      </p>

      <div className="space-y-5">
        {dimensions.map((dim, i) => {
          const color = thriveColor(dim.thriving);
          const label = thriveLabel(dim.thriving);
          const width = thriveWidth(dim.thriving);
          return (
            <motion.div key={dim.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-sm font-semibold" style={{ color: "#2C1810" }}>{dim.name}</span>
                  {dim.legendDescription && (
                    <p className="text-xs mt-0.5 max-w-sm" style={{ color: "#9B8E84" }}>{dim.legendDescription}</p>
                  )}
                </div>
                <span className="text-xs font-semibold ml-4 flex-shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}18`, color }}>{label}</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(44,24,16,0.08)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width }}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.06, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 mt-6 pt-4" style={{ borderTop: "1px solid rgba(44,24,16,0.08)" }}>
        {[
          { color: "#1B5E20", label: "Thriving", desc: "Strong, energised, aligned" },
          { color: "#81C784", label: "Building", desc: "Growing, some friction" },
          { color: "#F9A825", label: "Needs Attention", desc: "Significant gap or challenge" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs" style={{ color: "#746A5A" }}><span className="font-semibold">{item.label}</span> — {item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab C: Scorecard ─────────────────────────────────────────────────────────
function Scorecard({
  scorecard,
  firstName,
  onListen,
  orbState,
  isPlaying,
}: {
  scorecard: Snapshot["scorecard"] | null;
  firstName: string;
  onListen: () => void;
  orbState: OrbState;
  isPlaying: boolean;
}) {
  if (!scorecard || (!scorecard.purpose && !scorecard.values?.length && !scorecard.strengths?.length)) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
        <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>Your strategic plan will appear here.</p>
        <p className="text-xs" style={{ color: "#9B8E84" }}>Complete the voice intake to generate your personalised plan.</p>
      </div>
    );
  }

  const sections = [
    { label: "Purpose", content: scorecard.purpose, accent: "#C4622D" },
    { label: "Core Values", content: scorecard.values, accent: "#7A9E87" },
    { label: "Strengths", content: scorecard.strengths, accent: "#D4A843" },
    { label: "Strategic Challenges", content: scorecard.challenges, accent: "#8B5A2B" },
    { label: "Focus Areas", content: scorecard.focusAreas, accent: "#5B7FA6" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-lg" style={{ color: "#2C1810" }}>{firstName ? `${firstName}'s Plan` : "Your Plan"}</h3>
          <p className="text-xs" style={{ color: "#9B8E84" }}>Your coaching insights, distilled</p>
        </div>
        <button onClick={onListen} className="flex flex-col items-center gap-1">
          <VoiceOrb state={orbState} size={56} onClick={onListen} />
          <span className="text-xs" style={{ color: "#9B8E84" }}>{isPlaying ? "Stop" : "Listen to your story"}</span>
        </button>
      </div>

      <div className="space-y-6">
        {sections.map(({ label, content, accent }) => {
          if (!content || (Array.isArray(content) && content.length === 0)) return null;
          return (
            <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 rounded-full" style={{ backgroundColor: accent }} />
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>{label}</h4>
              </div>
              {typeof content === "string" ? (
                <p className="text-sm leading-relaxed" style={{ color: "#2C1810" }}>{content}</p>
              ) : (
                <ul className="space-y-2">
                  {content.map((item, i) => (
                    <li key={i} className="flex gap-2 items-start text-sm" style={{ color: "#2C1810" }}>
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: accent }} />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { profile, isHydrated } = useTayoProfile();
  const { getToken, getTokenAsync } = useAuth();
  const { isDemoMode } = useDemo();

  const [activeTab, setActiveTab] = useState<Tab>("journey");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [portraitOrbState, setPortraitOrbState] = useState<OrbState>("idle");
  const [isPortraitPlaying, setIsPortraitPlaying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [snapshotHistory, setSnapshotHistory] = useState<{ id: string; snapshot_version: number; created_at: string }[]>([]);
  const [remoteFirstName, setRemoteFirstName] = useState<string | null>(null);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [lastSessionEndedAt, setLastSessionEndedAt] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const token = getToken();

  useEffect(() => {
    if (isDemoMode) {
      setSnapshot(DEMO_SNAPSHOT as unknown as Snapshot);
      setRemoteFirstName(DEMO_PROFILE.first_name);
      setCoachName("Maya");
      setSessionCount(1);
      setLastSessionEndedAt(DEMO_PROFILE.last_session_ended_at);
      setSnapshotLoading(false);
      return;
    }

    const load = async () => {
      setSnapshotLoading(true);
      try {
        const tok = await getTokenAsync();
        if (!tok) { setSnapshotLoading(false); return; }
        const [snapRes, profileRes, sessionsRes] = await Promise.all([
          fetch(`${BASE_URL}/api/dashboard-snapshot/latest`, { headers: { Authorization: `Bearer ${tok}` } }),
          fetch(`${BASE_URL}/api/profile`, { headers: { Authorization: `Bearer ${tok}` } }),
          fetch(`${BASE_URL}/api/sessions`, { headers: { Authorization: `Bearer ${tok}` } }),
        ]);
        if (snapRes.ok) { const d = await snapRes.json(); if (d.snapshot) setSnapshot(d.snapshot); }
        if (profileRes.ok) {
          const d = await profileRes.json();
          if (d.profile?.first_name) setRemoteFirstName(d.profile.first_name);
          if (d.profile?.last_session_ended_at) setLastSessionEndedAt(d.profile.last_session_ended_at);
          const coachId = d.profile?.coach_id;
          const coachMap: Record<string, string> = { maya: "Maya", carlos: "Carlos", aisha: "Aisha", james: "James" };
          if (coachId) setCoachName(coachMap[coachId] ?? null);
        }
        if (sessionsRes.ok) {
          const d = await sessionsRes.json();
          setSessionCount((d.sessions ?? []).length);
        }
      } catch { /* silent */ }
      setSnapshotLoading(false);
    };
    load();
  }, [isDemoMode, getTokenAsync]);

  const loadHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/dashboard-snapshot/history`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setSnapshotHistory(d.history ?? []);
      setShowHistory(true);
    } catch { /* silent */ }
  };

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const playText = useCallback(async (text: string, onStart: () => void, onEnd: () => void) => {
    stopAudio();
    onStart();
    try {
      const coachVoiceId = localStorage.getItem("tayo_coach_voice_id") || undefined;
      const body: Record<string, string> = { text };
      if (coachVoiceId) body.voiceId = coachVoiceId;
      const res = await fetch(`${BASE_URL}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.play();
      audio.onended = onEnd;
      audio.onerror = onEnd;
    } catch { onEnd(); }
  }, [stopAudio]);

  const handleListenScorecard = useCallback(async () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
      setOrbState("idle");
      return;
    }
    const sc = snapshot?.scorecard;
    if (!sc) return;
    const text = [
      sc.purpose ? `Purpose: ${sc.purpose}` : "",
      sc.values?.length ? `Core values: ${sc.values.join(", ")}.` : "",
      sc.strengths?.length ? `Strengths: ${sc.strengths.join(". ")}.` : "",
      sc.challenges?.length ? `Strategic challenges: ${sc.challenges.join(". ")}.` : "",
      sc.focusAreas?.length ? `Focus areas: ${sc.focusAreas.join(". ")}.` : "",
    ].filter(Boolean).join(" ");
    if (!text) return;
    await playText(text,
      () => { setOrbState("speaking"); setIsPlaying(true); },
      () => { setIsPlaying(false); setOrbState("idle"); }
    );
  }, [snapshot, isPlaying, playText, stopAudio]);

  const handleListenPortrait = useCallback(async () => {
    if (isPortraitPlaying) {
      stopAudio();
      setIsPortraitPlaying(false);
      setPortraitOrbState("idle");
      return;
    }
    const narrative = snapshot?.narrative_blurb ?? profile?.overallNarrative;
    if (!narrative) return;
    const clean = stripNumbers(narrative);
    await playText(clean,
      () => { setPortraitOrbState("speaking"); setIsPortraitPlaying(true); },
      () => { setIsPortraitPlaying(false); setPortraitOrbState("idle"); }
    );
  }, [snapshot, profile, isPortraitPlaying, playText, stopAudio]);

  if (!isHydrated) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
    </div>
  );

  const firstName = remoteFirstName ?? profile?.firstName ?? "";
  const rawNarrative = snapshot?.narrative_blurb ?? profile?.overallNarrative ?? null;
  const displayData = {
    firstName,
    events: snapshot ? (snapshot.chapter_cards ?? []) : (profile?.lifeEvents ?? []),
    dimensions: snapshot ? (snapshot.portrait_stats ?? []) : (profile?.dimensions ?? []),
    scorecard: snapshot?.scorecard ?? null,
    narrative: rawNarrative ? stripNumbers(rawNarrative) : null,
  };

  // Session lock logic
  const sessionLocked = Boolean(
    lastSessionEndedAt &&
    new Date(lastSessionEndedAt).getTime() + 7 * 24 * 60 * 60 * 1000 > Date.now()
  );
  const daysUntilUnlock = sessionLocked && lastSessionEndedAt
    ? Math.ceil((new Date(lastSessionEndedAt).getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))
    : 0;
  const nextSessionNumber = sessionCount + 1;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "journey",   label: "Journey to Date" },
    { id: "portrait",  label: "Who You Are Now" },
    { id: "scorecard", label: "Your Strategic Plan" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      <Navbar firstName={firstName || undefined} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        {/* Header */}
        <div className="pt-8 pb-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-3xl mb-1"
            style={{ color: "#2C1810" }}
          >
            {firstName ? `${firstName}'s Dashboard` : "Your Dashboard"}
          </motion.h1>
          <p className="text-xs" style={{ color: "#9B8E84" }}>
            This is your evolving portrait — it will deepen with each session.{" "}
            <button onClick={loadHistory} className="inline-flex items-center gap-0.5 underline hover:no-underline">
              <History className="w-3 h-3" /> View history
            </button>
          </p>
        </div>

        {/* History panel */}
        <AnimatePresence>
          {showHistory && snapshotHistory.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="rounded-xl p-4 mb-4 overflow-hidden" style={{ backgroundColor: "rgba(44,24,16,0.04)", border: "1px solid rgba(44,24,16,0.08)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold" style={{ color: "#2C1810" }}>Portrait history</p>
                <button onClick={() => setShowHistory(false)} className="text-xs" style={{ color: "#9B8E84" }}>Close</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {snapshotHistory.map(h => (
                  <span key={h.id} className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(122,158,135,0.12)", color: "#7A9E87" }}>
                    v{h.snapshot_version} · {new Date(h.created_at).toLocaleDateString()}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Your Evolving Portrait — narrative blurb with voice listen button */}
        {displayData.narrative && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl p-5 mb-4"
            style={{ backgroundColor: "rgba(44,24,16,0.03)", border: "1px solid rgba(44,24,16,0.06)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9B8E84" }}>Your Evolving Portrait</p>
              <button
                onClick={handleListenPortrait}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all hover:opacity-70"
                style={{
                  backgroundColor: isPortraitPlaying ? "rgba(196,98,45,0.1)" : "rgba(44,24,16,0.05)",
                  color: isPortraitPlaying ? "#C4622D" : "#9B8E84",
                  border: `1px solid ${isPortraitPlaying ? "rgba(196,98,45,0.3)" : "rgba(44,24,16,0.1)"}`,
                }}
              >
                <Headphones className="w-3 h-3" />
                <span>{isPortraitPlaying ? "Stop" : "Listen"}</span>
              </button>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#5C4A3D", fontStyle: "italic" }}>{displayData.narrative}</p>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={activeTab === tab.id
                ? { backgroundColor: "#C4622D", color: "#F5F0E8", boxShadow: "0 2px 8px rgba(196,98,45,0.3)" }
                : { backgroundColor: "#FFFDF8", color: "#746A5A", border: "1px solid rgba(44,24,16,0.12)" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl p-6"
          style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)", boxShadow: "0 2px 12px rgba(44,24,16,0.04)" }}
        >
          {activeTab === "journey" && (
            <div>
              <h3 className="font-display text-base mb-1 text-center" style={{ color: "#2C1810" }}>Journey to Date</h3>
              <p className="text-xs text-center mb-6" style={{ color: "#9B8E84" }}>The chapters that shaped you</p>
              {snapshotLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} /></div>
              ) : (
                <ChapterCards events={displayData.events} />
              )}
            </div>
          )}

          {activeTab === "portrait" && (
            <div>
              <h3 className="font-display text-base mb-1 text-center" style={{ color: "#2C1810" }}>Who You Are Now</h3>
              <p className="text-xs text-center mb-6" style={{ color: "#9B8E84" }}>How you're progressing across the dimensions that shape a meaningful life.</p>
              {snapshotLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} /></div>
              ) : (
                <PortraitStats dimensions={displayData.dimensions} />
              )}
            </div>
          )}

          {activeTab === "scorecard" && (
            <div>
              <h3 className="font-display text-base mb-1 text-center" style={{ color: "#2C1810" }}>Your Strategic Plan</h3>
              <p className="text-xs text-center mb-6" style={{ color: "#9B8E84" }}>Purpose, values, strengths, and where to focus</p>
              {snapshotLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} /></div>
              ) : (
                <Scorecard
                  scorecard={displayData.scorecard}
                  firstName={displayData.firstName}
                  onListen={handleListenScorecard}
                  orbState={orbState}
                  isPlaying={isPlaying}
                />
              )}
            </div>
          )}
        </motion.div>

        {/* Begin Coaching Session CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          {isDemoMode ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl cursor-not-allowed opacity-60"
                style={{ backgroundColor: "rgba(44,24,16,0.04)", border: "1px solid rgba(44,24,16,0.08)" }}
              >
                <CheckCircle2 className="w-4 h-4" style={{ color: "#7A9E87" }} />
                <p className="text-sm font-semibold" style={{ color: "#746A5A" }}>Intake complete</p>
              </div>
              <button
                onClick={() => setLocation("/warmup")}
                className="text-xs underline hover:no-underline"
                style={{ color: "#9B8E84" }}
              >
                Start a coaching session →
              </button>
            </div>
          ) : sessionLocked ? (
            <div
              className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl"
              style={{ backgroundColor: "rgba(44,24,16,0.04)", border: "1px solid rgba(44,24,16,0.08)" }}
            >
              <Lock className="w-4 h-4" style={{ color: "#9B8E84" }} />
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: "#746A5A" }}>
                  Next session available in {daysUntilUnlock} {daysUntilUnlock === 1 ? "day" : "days"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#9B8E84" }}>
                  Use this time to work through your Next Moves.
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLocation("/intake")}
              className="px-8 py-4 rounded-2xl font-semibold text-base transition-all hover:scale-105 shadow-md"
              style={{ backgroundColor: "#C4622D", color: "#F5F0E8", boxShadow: "0 4px 16px rgba(196,98,45,0.3)" }}
            >
              {sessionCount === 0
                ? "Begin your first session"
                : `Start session ${nextSessionNumber}${coachName ? ` with ${coachName}` : ""}`}
            </button>
          )}
        </motion.div>
      </main>
    </div>
  );
}
