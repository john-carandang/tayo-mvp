import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile, type TayoDimension, type TayoLifeEvent } from "@/hooks/use-tayo-state";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, ChevronRight, Clock, History } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
type Tab = "journey" | "portrait" | "scorecard" | "moves";

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

interface Assignment {
  id: string;
  title: string;
  description: string;
  type: "daily_habit" | "one_off_task" | "reflection";
  due_date: string | null;
  status: "pending" | "complete" | "skipped";
  reflection: string | null;
}

interface Resource {
  title: string;
  type: "article" | "podcast" | "book" | "youtube";
  description: string;
  url?: string;
}

const MOOD_COLORS: Record<string, { bg: string; dot: string; label: string }> = {
  peak:         { bg: "rgba(122,158,135,0.15)", dot: "#7A9E87", label: "Breakthrough" },
  valley:       { bg: "rgba(196,98,45,0.1)",    dot: "#C4622D", label: "Challenging" },
  turning_point:{ bg: "rgba(212,168,67,0.12)",  dot: "#D4A843", label: "Transitional" },
  stable:       { bg: "rgba(91,127,166,0.1)",   dot: "#5B7FA6", label: "Formative" },
};

function thriveColor(thriving: number) {
  if (thriving >= 7) return "#7A9E87";
  if (thriving >= 4) return "#D4A843";
  return "#C4622D";
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

// ─── Tab A: Chapter Cards ────────────────────────────────────────────────────
function ChapterCards({ events }: { events: TayoLifeEvent[] }) {
  const sorted = [...events].sort((a, b) => a.approximateYear - b.approximateYear);
  const last = sorted[sorted.length - 1];

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
        <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>Your journey will appear here after your first session.</p>
        <p className="text-xs" style={{ color: "#9B8E84" }}>Complete the voice intake to build your chapter map.</p>
      </div>
    );
  }

  return (
    <div className="relative">
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
                  {ev !== last && (
                    <p className="text-xs" style={{ color: "#746A5A" }}>
                      {ev.actualizationLevel >= 75 ? "A time of growth and momentum." :
                       ev.actualizationLevel >= 50 ? "Finding your footing and sense of direction." :
                       "Navigating real difficulty and uncertainty."}
                    </p>
                  )}
                </motion.div>
                {i < sorted.length - 1 && (
                  <div className="flex items-center self-center mx-0" style={{ marginTop: "-8px" }}>
                    <div style={{ width: 20, height: 1, backgroundColor: "rgba(44,24,16,0.2)" }} />
                    <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(44,24,16,0.3)", marginLeft: -4 }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab B: Portrait Stats ───────────────────────────────────────────────────
function PortraitStats({ dimensions, firstName, purpose }: { dimensions: TayoDimension[]; firstName: string; purpose?: string }) {
  const initials = firstName ? firstName.slice(0, 2).toUpperCase() : "ME";

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
      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center font-display text-xl font-bold flex-shrink-0"
          style={{ backgroundColor: "rgba(196,98,45,0.15)", color: "#C4622D" }}>
          {initials}
        </div>
        <div>
          <h3 className="font-display text-xl" style={{ color: "#2C1810" }}>{firstName}</h3>
          {purpose && <p className="text-xs leading-relaxed mt-1 max-w-md" style={{ color: "#746A5A", fontStyle: "italic" }}>{purpose}</p>}
        </div>
      </div>

      {/* Dimension bars */}
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
                    <p className="text-xs mt-0.5" style={{ color: "#9B8E84" }}>{dim.legendDescription}</p>
                  )}
                </div>
                <span className="text-xs font-semibold ml-4 flex-shrink-0" style={{ color }}>{label}</span>
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

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 pt-4" style={{ borderTop: "1px solid rgba(44,24,16,0.08)" }}>
        {[
          { color: "#7A9E87", label: "Thriving", desc: "Strong, energised, aligned" },
          { color: "#D4A843", label: "Building", desc: "Growing, some friction" },
          { color: "#C4622D", label: "Needs Attention", desc: "Significant gap or challenge" },
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

// ─── Tab C: Scorecard ────────────────────────────────────────────────────────
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
        <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>Your strategic scorecard will appear here.</p>
        <p className="text-xs" style={{ color: "#9B8E84" }}>Complete the voice intake to generate your personalised scorecard.</p>
      </div>
    );
  }

  const sections: { label: string; content: string | string[] | undefined; accent: string }[] = [
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
          <h3 className="font-display text-lg" style={{ color: "#2C1810" }}>{firstName}'s Plan</h3>
          <p className="text-xs" style={{ color: "#9B8E84" }}>Your coaching insights, distilled</p>
        </div>
        <button onClick={onListen} className="flex flex-col items-center gap-1">
          <VoiceOrb state={orbState} size={60} onClick={onListen} />
          <span className="text-xs" style={{ color: "#9B8E84" }}>{isPlaying ? "Stop" : "Listen"}</span>
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
                <ul className="space-y-1.5">
                  {content.map((item, i) => (
                    <li key={i} className="flex gap-2 items-start text-sm" style={{ color: "#2C1810" }}>
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: accent }} />
                      {item}
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

// ─── Tab D: Next Moves ───────────────────────────────────────────────────────
function NextMoves({
  assignments,
  profile,
  token,
  onAssignmentUpdate,
}: {
  assignments: Assignment[];
  profile: ReturnType<typeof useTayoProfile>["profile"];
  token: string | null;
  onAssignmentUpdate: () => void;
}) {
  const [reflectionOpen, setReflectionOpen] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState("");
  const [saving, setSaving] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    if (!profile || !token || resources.length > 0) return;
    const fetchResources = async () => {
      setLoadingResources(true);
      try {
        const res = await fetch(`${BASE_URL}/api/resources`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ profile }),
        });
        const data = await res.json();
        setResources(data.resources ?? []);
      } catch { /* silent */ }
      setLoadingResources(false);
    };
    fetchResources();
  }, [profile, token]);

  const markComplete = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "complete" }),
      });
      setReflectionOpen(id);
      setReflectionText("");
      onAssignmentUpdate();
    } catch { /* silent */ }
  };

  const saveReflection = async (id: string) => {
    if (!token || !reflectionText.trim()) return;
    setSaving(true);
    try {
      await fetch(`${BASE_URL}/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reflection: reflectionText }),
      });
      setReflectionOpen(null);
      setReflectionText("");
    } catch { /* silent */ }
    setSaving(false);
  };

  const TYPE_LABELS: Record<string, string> = {
    daily_habit: "Daily habit",
    one_off_task: "One-off task",
    reflection: "Reflection",
  };

  if (assignments.length === 0 && !loadingResources) {
    return (
      <div>
        <div className="rounded-2xl p-8 text-center mb-8" style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>Your moves will appear here after your first coaching session.</p>
          <p className="text-xs" style={{ color: "#9B8E84" }}>Complete your coaching session to receive personalised assignments.</p>
        </div>
        {profile && <ResourceSection resources={resources} loading={loadingResources} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {assignments.map(a => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5"
          style={{ backgroundColor: "#FFFDF8", border: "1.5px solid rgba(44,24,16,0.1)" }}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-start gap-3 flex-1">
              <button
                onClick={() => a.status !== "complete" && markComplete(a.id)}
                className="mt-0.5 flex-shrink-0 transition-colors"
                style={{ color: a.status === "complete" ? "#7A9E87" : "rgba(44,24,16,0.25)" }}
                disabled={a.status === "complete"}
              >
                {a.status === "complete" ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </button>
              <div>
                <h4 className={cn("font-display text-base", a.status === "complete" && "line-through opacity-60")} style={{ color: "#2C1810" }}>{a.title}</h4>
                <p className="text-sm mt-0.5" style={{ color: "#746A5A" }}>{a.description}</p>
              </div>
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: "rgba(122,158,135,0.12)", color: "#7A9E87" }}>
              {TYPE_LABELS[a.type] ?? a.type}
            </span>
          </div>
          {a.due_date && (
            <div className="flex items-center gap-1.5 ml-8 mt-1">
              <Clock className="w-3 h-3" style={{ color: "#9B8E84" }} />
              <span className="text-xs" style={{ color: "#9B8E84" }}>Due {new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
          )}

          {/* Reflection panel */}
          <AnimatePresence>
            {reflectionOpen === a.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 ml-8 overflow-hidden"
              >
                <p className="text-xs font-medium mb-2" style={{ color: "#C4622D" }}>How did it go? What did you learn?</p>
                <textarea
                  value={reflectionText}
                  onChange={e => setReflectionText(e.target.value.slice(0, 2000))}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-2"
                  style={{ backgroundColor: "#F5F0E8", border: "1px solid rgba(44,24,16,0.15)", color: "#2C1810" }}
                  placeholder="Share what happened and what you took from it…"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveReflection(a.id)}
                    disabled={saving || !reflectionText.trim()}
                    className="text-xs font-semibold px-4 py-2 rounded-full disabled:opacity-40"
                    style={{ backgroundColor: "#7A9E87", color: "#F5F0E8" }}
                  >
                    {saving ? "Saving…" : "Save reflection"}
                  </button>
                  <button onClick={() => setReflectionOpen(null)} className="text-xs" style={{ color: "#9B8E84" }}>Skip for now</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {a.reflection && (
            <div className="mt-3 ml-8 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(122,158,135,0.08)" }}>
              <p className="text-xs" style={{ color: "#7A9E87", fontStyle: "italic" }}>"{a.reflection}"</p>
            </div>
          )}
        </motion.div>
      ))}
      <ResourceSection resources={resources} loading={loadingResources} />
    </div>
  );
}

function ResourceSection({ resources, loading }: { resources: Resource[]; loading: boolean }) {
  const TYPE_ICONS: Record<string, string> = { article: "📄", podcast: "🎧", book: "📚", youtube: "▶️" };

  if (loading) return <div className="text-center py-6"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" /></div>;
  if (resources.length === 0) return null;

  return (
    <div className="mt-2">
      <h4 className="font-display text-base mb-4" style={{ color: "#2C1810" }}>Resources for you</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {resources.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl p-4"
            style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}
          >
            <div className="flex items-start gap-3">
              <span className="text-base flex-shrink-0 mt-0.5">{TYPE_ICONS[r.type] ?? "📎"}</span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#D4A843" }}>{r.type}</span>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="block font-semibold text-sm mt-0.5 hover:underline" style={{ color: "#2C1810" }}>{r.title}</a>
                ) : (
                  <p className="font-semibold text-sm mt-0.5" style={{ color: "#2C1810" }}>{r.title}</p>
                )}
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "#746A5A" }}>{r.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { profile, isHydrated } = useTayoProfile();
  const { getToken, getTokenAsync } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("journey");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [snapshotHistory, setSnapshotHistory] = useState<{ id: string; snapshot_version: number; created_at: string }[]>([]);
  const [remoteFirstName, setRemoteFirstName] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const token = getToken();

  useEffect(() => {
    const load = async () => {
      setSnapshotLoading(true);
      try {
        const tok = await getTokenAsync();
        if (!tok) { setSnapshotLoading(false); return; }
        const [snapRes, asgRes, profileRes] = await Promise.all([
          fetch(`${BASE_URL}/api/dashboard-snapshot/latest`, { headers: { Authorization: `Bearer ${tok}` } }),
          fetch(`${BASE_URL}/api/assignments`, { headers: { Authorization: `Bearer ${tok}` } }),
          fetch(`${BASE_URL}/api/profile`, { headers: { Authorization: `Bearer ${tok}` } }),
        ]);
        if (snapRes.ok) { const d = await snapRes.json(); if (d.snapshot) setSnapshot(d.snapshot); }
        if (asgRes.ok) { const d = await asgRes.json(); setAssignments(d.assignments ?? []); }
        if (profileRes.ok) {
          const d = await profileRes.json();
          if (d.profile?.first_name) setRemoteFirstName(d.profile.first_name);
        }
      } catch { /* silent */ }
      setSnapshotLoading(false);
    };
    load();
  }, [getTokenAsync]);

  const loadHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/dashboard-snapshot/history`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setSnapshotHistory(d.history ?? []);
      setShowHistory(true);
    } catch { /* silent */ }
  };

  const refreshAssignments = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/assignments`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setAssignments(d.assignments ?? []);
    } catch { /* silent */ }
  };

  const handleListenScorecard = useCallback(async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      audioRef.current = null;
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
    setOrbState("speaking");
    setIsPlaying(true);
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
      audio.onended = () => { setIsPlaying(false); setOrbState("idle"); };
      audio.onerror = () => { setIsPlaying(false); setOrbState("idle"); };
    } catch {
      setIsPlaying(false);
      setOrbState("idle");
    }
  }, [snapshot, isPlaying]);

  if (!isHydrated) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const firstName = profile?.firstName || remoteFirstName || "";
  const displayData = {
    firstName,
    events: snapshot ? (snapshot.chapter_cards ?? []) : (profile?.lifeEvents ?? []),
    dimensions: snapshot ? (snapshot.portrait_stats ?? []) : (profile?.dimensions ?? []),
    scorecard: snapshot?.scorecard ?? null,
    narrative: snapshot?.narrative_blurb ?? profile?.overallNarrative ?? null,
    purpose: snapshot?.scorecard?.purpose,
  };

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "journey",   label: "Journey to Date" },
    { id: "portrait",  label: "Who You Are Now" },
    { id: "scorecard", label: "Your Strategic Plan" },
    { id: "moves",     label: "Your Next Moves" },
  ];

  return (
    <StepLayout step={2} title={displayData.firstName ? `${displayData.firstName}'s Dashboard` : "Your Dashboard"}>
      <div className="space-y-6">

        {/* Evolving portrait banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-2.5 px-4 rounded-full mx-auto max-w-md text-xs font-medium"
          style={{ backgroundColor: "rgba(122,158,135,0.12)", color: "#7A9E87" }}
        >
          This is your evolving portrait — it will deepen with each session.
          <button onClick={loadHistory} className="ml-2 inline-flex items-center gap-0.5 underline hover:no-underline">
            <History className="w-3 h-3" /> View history
          </button>
        </motion.div>

        {/* History panel */}
        <AnimatePresence>
          {showHistory && snapshotHistory.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="rounded-xl p-4 overflow-hidden" style={{ backgroundColor: "rgba(44,24,16,0.04)", border: "1px solid rgba(44,24,16,0.08)" }}>
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

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn("px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeTab === tab.id ? "bg-primary text-primary-foreground shadow-md" : "bg-card text-muted-foreground border border-border hover:text-foreground")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Narrative blurb — persists across all tabs */}
        {displayData.narrative && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl p-5"
            style={{ backgroundColor: "rgba(44,24,16,0.03)", border: "1px solid rgba(44,24,16,0.06)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#9B8E84" }}>Your evolving portrait</p>
            <p className="text-sm leading-relaxed" style={{ color: "#5C4A3D", fontStyle: "italic" }}>{displayData.narrative}</p>
          </motion.div>
        )}

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="card-warm p-6"
        >
          {activeTab === "journey" && (
            <div>
              <h3 className="font-display text-base mb-1 text-center" style={{ color: "#2C1810" }}>Journey to Date</h3>
              <p className="text-xs text-center mb-6" style={{ color: "#9B8E84" }}>The chapters that shaped you, in the order they happened</p>
              {snapshotLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
              ) : (
                <ChapterCards events={displayData.events} />
              )}
            </div>
          )}

          {activeTab === "portrait" && (
            <div>
              <h3 className="font-display text-base mb-1 text-center" style={{ color: "#2C1810" }}>Who You Are Now</h3>
              <p className="text-xs text-center mb-6" style={{ color: "#9B8E84" }}>Your life across each dimension — honestly mapped</p>
              {snapshotLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
              ) : (
                <PortraitStats dimensions={displayData.dimensions} firstName={displayData.firstName} purpose={displayData.purpose} />
              )}
            </div>
          )}

          {activeTab === "scorecard" && (
            <div>
              <h3 className="font-display text-base mb-1 text-center" style={{ color: "#2C1810" }}>Your Strategic Plan</h3>
              <p className="text-xs text-center mb-6" style={{ color: "#9B8E84" }}>Purpose, values, strengths, and where to focus your energy</p>
              {snapshotLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
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

          {activeTab === "moves" && (
            <div>
              <h3 className="font-display text-base mb-1 text-center" style={{ color: "#2C1810" }}>Your Next Moves</h3>
              <p className="text-xs text-center mb-6" style={{ color: "#9B8E84" }}>Assignments from your coaching sessions, tailored to your journey</p>
              <NextMoves
                assignments={assignments}
                profile={profile}
                token={token}
                onAssignmentUpdate={refreshAssignments}
              />
            </div>
          )}
        </motion.div>

        {/* Coaching session CTA */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center">
          <button
            onClick={() => setLocation("/chat")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all border-2"
            style={{ borderColor: "#C4622D", color: "#C4622D" }}
          >
            Begin coaching session
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </StepLayout>
  );
}
