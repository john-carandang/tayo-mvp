import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDemo,
  DEMO_ASSIGNMENTS,
  DEMO_RESOURCES,
  DEMO_PROFILE,
  type RecommendedResource,
} from "@/contexts/DemoContext";
import { Navbar } from "@/components/layout/Navbar";
import { CheckCircle2, Circle, Clock, Lock, Check } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface Assignment {
  id: string;
  title: string;
  description: string;
  type: "daily_habit" | "one_off_task" | "reflection";
  due_date: string | null;
  status: "pending" | "complete" | "skipped";
  reflection: string | null;
}

// ─── Commitment emoji ─────────────────────────────────────────────────────────
const DEMO_EMOJI: Record<string, string> = {
  "demo-move-1": "📅",
  "demo-move-2": "🏃",
  "demo-move-3": "💬",
};
const TYPE_EMOJI: Record<string, string> = {
  daily_habit: "🔁",
  one_off_task: "✅",
  reflection: "💭",
};

function getCommitmentEmoji(a: Assignment): string {
  return DEMO_EMOJI[a.id] ?? TYPE_EMOJI[a.type] ?? "•";
}

// ─── Resource subsection config ───────────────────────────────────────────────
const RESOURCE_SECTIONS: { type: RecommendedResource["type"]; label: string }[] = [
  { type: "book",      label: "Books" },
  { type: "article",   label: "Articles" },
  { type: "podcast",   label: "Podcasts" },
  { type: "video",     label: "Videos / YouTube" },
  { type: "song",      label: "Songs" },
  { type: "instagram", label: "People worth following" },
  { type: "purchase",  label: "Things that could help" },
];

const RESOURCE_CTA: Record<string, string> = {
  book:      "View book",
  article:   "Read article",
  podcast:   "Listen",
  video:     "Watch",
  song:      "Listen on YouTube",
  instagram: "View profile",
  purchase:  "Learn more",
};

const RESOURCE_REFLECTION_PLACEHOLDER: Record<string, string> = {
  book:      "What's one thing you're taking away?",
  article:   "What's one thing you're taking away?",
  podcast:   "What's one thing you're taking away?",
  video:     "What's one thing you're taking away?",
  song:      "What did this bring up for you?",
  instagram: "What about this person resonates with you?",
  purchase:  "Would this actually help you? Why or why not?",
};

function resourceKey(r: RecommendedResource): string {
  return `${r.type}:${r.title}`;
}

// ─── Reflection textarea (shared style) ──────────────────────────────────────
function ReflectionArea({
  placeholder,
  value,
  onChange,
  onSave,
  onSkip,
  maxLength = 280,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onSkip: () => void;
  maxLength?: number;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs mb-2" style={{ color: "#C4622D", fontWeight: 500 }}>
        Add a quick reflection (1–2 sentences) — this will inform your next session.
      </p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value.slice(0, maxLength))}
        rows={3}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-2"
        style={{
          backgroundColor: "#F5F0E8",
          border: "1px solid rgba(196,98,45,0.25)",
          color: "#2C1810",
          fontFamily: "'Playfair Display', Georgia, serif",
        }}
        placeholder={placeholder}
        autoFocus
      />
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          className="text-xs font-semibold px-4 py-1.5 rounded-full"
          style={{ backgroundColor: "#7A9E87", color: "#F7F0E0" }}
        >
          Save reflection
        </button>
        <button onClick={onSkip} className="text-xs" style={{ color: "#9B8E84" }}>
          Skip for now
        </button>
        {maxLength && (
          <span className="text-xs ml-auto" style={{ color: "rgba(155,142,132,0.7)" }}>
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NextMoves() {
  const [, setLocation] = useLocation();
  const { getTokenAsync } = useAuth();
  const { isDemoMode } = useDemo();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [openCommitmentReflections, setOpenCommitmentReflections] = useState<Set<string>>(new Set());
  const [commitmentDrafts, setCommitmentDrafts] = useState<Record<string, string>>({});
  const [savingReflection, setSavingReflection] = useState(false);

  const [resources, setResources] = useState<RecommendedResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [checkedResources, setCheckedResources] = useState<Set<string>>(new Set());
  const [openResourceReflections, setOpenResourceReflections] = useState<Set<string>>(new Set());
  const [resourceDrafts, setResourceDrafts] = useState<Record<string, string>>({});
  const [savedResourceReflections, setSavedResourceReflections] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [sessionLocked, setSessionLocked] = useState(false);
  const [daysUntilUnlock, setDaysUntilUnlock] = useState(0);
  const [firstName, setFirstName] = useState<string | undefined>();

  const recsFetchedRef = useRef(false);

  // ─── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode) {
      setAssignments(DEMO_ASSIGNMENTS);
      setFirstName(DEMO_PROFILE.first_name);
      setSessionLocked(false);
      setLoading(false);

      if (recsFetchedRef.current) return;
      recsFetchedRef.current = true;

      // Check sessionStorage cache for demo recommendations
      const CACHE_KEY = "tayo_recs_demo";
      const cached = (() => {
        try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
      })();

      if (cached && Array.isArray(cached) && cached.length > 0) {
        setResources(cached);
        return;
      }

      setLoadingResources(true);
      fetch(`${BASE_URL}/api/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoMode: true }),
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => {
          const recs: RecommendedResource[] = Array.isArray(d.resources) && d.resources.length > 0
            ? d.resources
            : DEMO_RESOURCES;
          setResources(recs);
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(recs)); } catch { /* non-fatal */ }
        })
        .catch(() => setResources(DEMO_RESOURCES))
        .finally(() => setLoadingResources(false));

      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const tok = await getTokenAsync();
        if (!tok) { setLoading(false); return; }

        const [asgRes, profileRes] = await Promise.all([
          fetch(`${BASE_URL}/api/assignments`, { headers: { Authorization: `Bearer ${tok}` } }),
          fetch(`${BASE_URL}/api/profile`, { headers: { Authorization: `Bearer ${tok}` } }),
        ]);

        if (asgRes.ok) {
          const d = await asgRes.json();
          setAssignments(d.assignments ?? []);
        }

        if (profileRes.ok) {
          const d = await profileRes.json();
          if (d.profile?.first_name) setFirstName(d.profile.first_name);
          if (d.profile?.last_session_ended_at) {
            const ended = new Date(d.profile.last_session_ended_at).getTime();
            const unlockAt = ended + 7 * 24 * 60 * 60 * 1000;
            const locked = unlockAt > Date.now();
            setSessionLocked(locked);
            if (locked) setDaysUntilUnlock(Math.ceil((unlockAt - Date.now()) / (24 * 60 * 60 * 1000)));
          }
        }

        // Load recommendations
        if (!recsFetchedRef.current) {
          recsFetchedRef.current = true;
          setLoadingResources(true);
          try {
            const profileFromStorage = (() => {
              try { return JSON.parse(localStorage.getItem("tayo_profile") || "null"); } catch { return null; }
            })();
            const userContext = {
              intakeSummary: profileFromStorage?.intakeSummary || profileFromStorage?.summary || "",
              coreValues: profileFromStorage?.values || profileFromStorage?.coreValues || [],
              focusAreas: profileFromStorage?.focusAreas || [],
              strengths: profileFromStorage?.strengths || [],
            };
            const recRes = await fetch(`${BASE_URL}/api/recommendations`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
              body: JSON.stringify({ userContext }),
            });
            if (recRes.ok) {
              const recData = await recRes.json();
              const recs: RecommendedResource[] = Array.isArray(recData.resources) ? recData.resources : [];
              setResources(recs);
              if (recs.length > 0) {
                try {
                  localStorage.setItem("tayo_resources", JSON.stringify(recs.slice(0, 50)));
                } catch { /* non-fatal */ }
              }
            }
          } catch { /* silent */ }
          setLoadingResources(false);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, [isDemoMode, getTokenAsync]);

  // ─── Commitment toggle ─────────────────────────────────────────────────────
  const toggleCommitment = async (a: Assignment) => {
    const newStatus: Assignment["status"] = a.status === "complete" ? "pending" : "complete";

    if (isDemoMode) {
      setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, status: newStatus } : x));
      setOpenCommitmentReflections(prev => { const n = new Set(prev); n.add(a.id); return n; });
      setCommitmentDrafts(prev => ({ ...prev, [a.id]: "" }));
      return;
    }

    const tok = await getTokenAsync();
    if (!tok) return;
    try {
      await fetch(`${BASE_URL}/api/assignments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ status: newStatus }),
      });
      setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, status: newStatus } : x));
      setOpenCommitmentReflections(prev => { const n = new Set(prev); n.add(a.id); return n; });
      setCommitmentDrafts(prev => ({ ...prev, [a.id]: a.reflection || "" }));
    } catch { /* silent */ }
  };

  const saveCommitmentReflection = async (id: string) => {
    const text = (commitmentDrafts[id] || "").trim();
    const closeReflection = () => {
      setOpenCommitmentReflections(prev => { const n = new Set(prev); n.delete(id); return n; });
    };

    if (!text) { closeReflection(); return; }

    if (isDemoMode) {
      setAssignments(prev => prev.map(x => x.id === id ? { ...x, reflection: text } : x));
      closeReflection();
      return;
    }

    setSavingReflection(true);
    const tok = await getTokenAsync();
    if (!tok) { setSavingReflection(false); return; }
    try {
      await fetch(`${BASE_URL}/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ reflection: text }),
      });
      setAssignments(prev => prev.map(x => x.id === id ? { ...x, reflection: text } : x));
      closeReflection();
    } catch { /* silent */ }
    setSavingReflection(false);
  };

  // ─── Resource toggle ───────────────────────────────────────────────────────
  const toggleResourceCheck = (key: string) => {
    setCheckedResources(prev => {
      const n = new Set(prev);
      if (n.has(key)) { n.delete(key); } else { n.add(key); }
      return n;
    });
    setOpenResourceReflections(prev => { const n = new Set(prev); n.add(key); return n; });
    setResourceDrafts(prev => ({ ...prev, [key]: prev[key] ?? "" }));
  };

  const saveResourceReflection = (key: string) => {
    const text = (resourceDrafts[key] || "").trim();
    setSavedResourceReflections(prev => ({ ...prev, [key]: text }));
    setOpenResourceReflections(prev => { const n = new Set(prev); n.delete(key); return n; });
  };

  // ─── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
        <Navbar firstName={firstName} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
        </div>
      </div>
    );
  }

  const pendingAssignments = assignments.filter(a => a.status === "pending");
  const completedAssignments = assignments.filter(a => a.status === "complete");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      <Navbar firstName={firstName} />

      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* ── Session banner ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 mb-10 flex items-center justify-between gap-4"
          style={{
            backgroundColor: (isDemoMode || sessionLocked) ? "rgba(44,24,16,0.04)" : "rgba(196,98,45,0.06)",
            border: `1px solid ${(isDemoMode || sessionLocked) ? "rgba(44,24,16,0.08)" : "rgba(196,98,45,0.2)"}`,
          }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "#2C1810" }}>
              {isDemoMode
                ? "Intake complete"
                : sessionLocked
                  ? `Next session unlocks in ${daysUntilUnlock} ${daysUntilUnlock === 1 ? "day" : "days"}`
                  : "Your next session is ready"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#9B8E84" }}>
              {isDemoMode
                ? "Work through your commitments below."
                : sessionLocked
                  ? "Use this time to work through your commitments below."
                  : "Find a quiet space and give yourself 25–30 minutes."}
            </p>
          </div>
          {isDemoMode ? (
            <div className="flex items-center gap-1.5 flex-shrink-0 opacity-50 cursor-not-allowed">
              <CheckCircle2 className="w-4 h-4" style={{ color: "#7A9E87" }} />
              <span className="text-xs font-semibold" style={{ color: "#746A5A" }}>Done</span>
            </div>
          ) : sessionLocked ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Lock className="w-4 h-4" style={{ color: "#9B8E84" }} />
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold" style={{ color: "#2C1810" }}>{daysUntilUnlock}</span>
                <span className="text-xs" style={{ color: "#9B8E84" }}>days</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLocation("/intake")}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
              style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
            >
              Begin now
            </button>
          )}
        </motion.div>

        {/* ── Commitments ────────────────────────────────────────────────── */}
        <div className="mb-12">
          <h2 className="font-display text-xl mb-1" style={{ color: "#2C1810" }}>Your commitments</h2>
          <p className="text-sm mb-6" style={{ color: "#746A5A" }}>What you seek to do before your next session.</p>

          {pendingAssignments.length === 0 && completedAssignments.length === 0 ? (
            <div className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
              <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>
                Your commitments will appear here after your first session.
              </p>
              <p className="text-xs" style={{ color: "#9B8E84" }}>
                During the session, your coach will ask you to define 1–2 things to work on.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pending */}
              {pendingAssignments.map(a => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: "#FFFDF8", border: "1.5px solid rgba(44,24,16,0.10)" }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleCommitment(a)}
                      className="mt-0.5 flex-shrink-0 transition-all hover:scale-110"
                      style={{ color: "rgba(44,24,16,0.25)" }}
                      aria-label="Mark complete"
                    >
                      <Circle className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <span className="text-base flex-shrink-0 leading-none mt-0.5">{getCommitmentEmoji(a)}</span>
                        <div className="flex-1 flex items-start justify-between gap-2">
                          <h4 className="font-display text-base leading-snug" style={{ color: "#2C1810" }}>
                            {a.title}
                          </h4>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: "rgba(122,158,135,0.12)", color: "#7A9E87" }}>
                            {a.type === "daily_habit" ? "Daily habit" : a.type === "reflection" ? "Reflection" : "One-off"}
                          </span>
                        </div>
                      </div>
                      {a.description && (
                        <p className="text-sm mt-1 pl-6" style={{ color: "#746A5A" }}>{a.description}</p>
                      )}
                      {a.due_date && (
                        <div className="flex items-center gap-1 mt-1.5 pl-6">
                          <Clock className="w-3 h-3" style={{ color: "#9B8E84" }} />
                          <span className="text-xs" style={{ color: "#9B8E84" }}>
                            Due {new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reflection textarea */}
                  <AnimatePresence>
                    {openCommitmentReflections.has(a.id) && (
                      <motion.div
                        key="reflection"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-1 ml-8"
                      >
                        <ReflectionArea
                          placeholder="What came up for you around this?"
                          value={commitmentDrafts[a.id] ?? ""}
                          onChange={v => setCommitmentDrafts(prev => ({ ...prev, [a.id]: v }))}
                          onSave={() => saveCommitmentReflection(a.id)}
                          onSkip={() => setOpenCommitmentReflections(prev => { const n = new Set(prev); n.delete(a.id); return n; })}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {/* Completed */}
              {completedAssignments.map(a => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.07)", opacity: 0.72 }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleCommitment(a)}
                      className="mt-0.5 flex-shrink-0 transition-all hover:scale-110"
                      aria-label="Mark incomplete"
                    >
                      <CheckCircle2 className="w-5 h-5" style={{ color: "#7A9E87" }} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base flex-shrink-0">{getCommitmentEmoji(a)}</span>
                        <h4 className="font-display text-base line-through" style={{ color: "#2C1810" }}>{a.title}</h4>
                      </div>
                      {a.reflection && !openCommitmentReflections.has(a.id) && (
                        <div className="mt-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(122,158,135,0.08)" }}>
                          <p className="text-xs" style={{ color: "#7A9E87", fontStyle: "italic" }}>"{a.reflection}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {openCommitmentReflections.has(a.id) && (
                      <motion.div
                        key="reflection"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-1 ml-8"
                      >
                        <ReflectionArea
                          placeholder="What came up for you around this?"
                          value={commitmentDrafts[a.id] ?? ""}
                          onChange={v => setCommitmentDrafts(prev => ({ ...prev, [a.id]: v }))}
                          onSave={() => saveCommitmentReflection(a.id)}
                          onSkip={() => setOpenCommitmentReflections(prev => { const n = new Set(prev); n.delete(a.id); return n; })}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ── Resources ──────────────────────────────────────────────────── */}
        <div>
          <h2 className="font-display text-xl mb-1" style={{ color: "#2C1810" }}>Resources for you</h2>
          <p className="text-sm mb-6" style={{ color: "#746A5A" }}>Curated based on your profile and story.</p>

          {loadingResources ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
            </div>
          ) : resources.length === 0 ? (
            <div className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
              <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>
                Resources will appear here after your first session.
              </p>
              <p className="text-xs" style={{ color: "#9B8E84" }}>
                They'll be tailored specifically to your story and goals.
              </p>
            </div>
          ) : (
            <div>
              {RESOURCE_SECTIONS.map((section, sIdx) => {
                const sectionResources = resources.filter(r => r.type === section.type);
                if (sectionResources.length === 0) return null;

                return (
                  <div
                    key={section.type}
                    style={{
                      borderTop: sIdx === 0 ? "none" : "0.5px solid rgba(60,40,20,0.10)",
                      paddingTop: sIdx === 0 ? 0 : "24px",
                      marginTop: sIdx === 0 ? 0 : "24px",
                    }}
                  >
                    {/* Eyebrow label */}
                    <p style={{
                      fontFamily: "system-ui, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      color: "#C4622D",
                      marginBottom: "12px",
                    }}>
                      {section.label}
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {sectionResources.map(r => {
                        const key = resourceKey(r);
                        const isChecked = checkedResources.has(key);
                        const isReflectionOpen = openResourceReflections.has(key);
                        const noteLabel = r.type === "instagram" || r.type === "purchase" ? "Noted" : "Mark as reviewed";
                        const reviewedLabel = r.type === "instagram" || r.type === "purchase" ? "Noted" : "Reviewed";
                        const isPurchase = r.type === "purchase";

                        return (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                              background: "#fff",
                              border: "0.5px solid rgba(60,40,20,0.12)",
                              borderRadius: "12px",
                              padding: "20px 24px",
                            }}
                          >
                            {/* Card header row */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 style={{
                                  fontWeight: 500,
                                  fontSize: "16px",
                                  color: "#1C1812",
                                  lineHeight: 1.3,
                                  marginBottom: "6px",
                                }}>
                                  {r.title}
                                </h4>
                                <p style={{
                                  fontSize: "14px",
                                  color: "#5a4a3f",
                                  fontFamily: "'Playfair Display', Georgia, serif",
                                  lineHeight: 1.5,
                                  marginBottom: "6px",
                                }}>
                                  {r.description}
                                </p>
                                <p style={{
                                  fontSize: "13px",
                                  fontStyle: "italic",
                                  color: "#8a7060",
                                  lineHeight: 1.5,
                                }}>
                                  Why this: {r.rationale}
                                </p>
                              </div>

                              {/* Checkmark toggle */}
                              <div className="flex-shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
                                <button
                                  onClick={() => toggleResourceCheck(key)}
                                  className="flex items-center gap-1.5 group"
                                  aria-label={isChecked ? reviewedLabel : noteLabel}
                                >
                                  <span style={{
                                    fontSize: "11px",
                                    fontWeight: 500,
                                    color: isChecked ? "#2A6B63" : "#9B8E84",
                                    whiteSpace: "nowrap",
                                  }}>
                                    {isChecked ? reviewedLabel : noteLabel}
                                  </span>
                                  <div
                                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{
                                      backgroundColor: isChecked ? "#2A6B63" : "transparent",
                                      borderColor: isChecked ? "#2A6B63" : "rgba(155,142,132,0.5)",
                                    }}
                                  >
                                    {isChecked && <Check className="w-3 h-3" style={{ color: "#F7F0E0" }} />}
                                  </div>
                                </button>
                              </div>
                            </div>

                            {/* Action link */}
                            <div className="mt-4">
                              {isPurchase ? (
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: "inline-block",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    padding: "6px 16px",
                                    borderRadius: "999px",
                                    backgroundColor: "#C4622D",
                                    color: "#F7F0E0",
                                    textDecoration: "none",
                                  }}
                                >
                                  {RESOURCE_CTA[r.type]}
                                </a>
                              ) : (
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    color: "#C4622D",
                                    textDecoration: "none",
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                                  onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                                >
                                  {RESOURCE_CTA[r.type] ?? "View"} →
                                </a>
                              )}
                            </div>

                            {/* Reflection textarea */}
                            <AnimatePresence>
                              {isReflectionOpen && (
                                <motion.div
                                  key="resource-reflection"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-4 pt-4" style={{ borderTop: "0.5px solid rgba(60,40,20,0.08)" }}>
                                    <textarea
                                      value={resourceDrafts[key] ?? ""}
                                      onChange={e => setResourceDrafts(prev => ({
                                        ...prev, [key]: e.target.value.slice(0, 280),
                                      }))}
                                      rows={3}
                                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-2"
                                      style={{
                                        backgroundColor: "#F5F0E8",
                                        border: "1px solid rgba(196,98,45,0.25)",
                                        color: "#2C1810",
                                        fontFamily: "'Playfair Display', Georgia, serif",
                                      }}
                                      placeholder={RESOURCE_REFLECTION_PLACEHOLDER[r.type] ?? "What came up for you?"}
                                      autoFocus
                                    />
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => saveResourceReflection(key)}
                                        className="text-xs font-semibold px-4 py-1.5 rounded-full"
                                        style={{ backgroundColor: "#7A9E87", color: "#F7F0E0" }}
                                      >
                                        Save reflection
                                      </button>
                                      <button
                                        onClick={() => setOpenResourceReflections(prev => { const n = new Set(prev); n.delete(key); return n; })}
                                        className="text-xs"
                                        style={{ color: "#9B8E84" }}
                                      >
                                        Skip for now
                                      </button>
                                      <span className="text-xs ml-auto" style={{ color: "rgba(155,142,132,0.7)" }}>
                                        {(resourceDrafts[key] ?? "").length}/280
                                      </span>
                                    </div>
                                    {savedResourceReflections[key] && (
                                      <div className="mt-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(122,158,135,0.08)" }}>
                                        <p className="text-xs" style={{ color: "#7A9E87", fontStyle: "italic" }}>
                                          "{savedResourceReflections[key]}"
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
