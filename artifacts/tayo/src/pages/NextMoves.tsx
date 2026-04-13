import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { CheckCircle2, Circle, Clock, Lock } from "lucide-react";

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

interface Resource {
  title: string;
  type: "article" | "podcast" | "book" | "youtube";
  description: string;
  url?: string;
}

const TYPE_ICONS: Record<string, string> = { article: "📄", podcast: "🎧", book: "📚", youtube: "▶️" };
const TYPE_LABELS: Record<string, string> = { daily_habit: "Daily habit", one_off_task: "One-off task", reflection: "Reflection" };

export default function NextMoves() {
  const [, setLocation] = useLocation();
  const { getTokenAsync } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState("");
  const [savingReflection, setSavingReflection] = useState(false);
  const [sessionLocked, setSessionLocked] = useState(false);
  const [daysUntilUnlock, setDaysUntilUnlock] = useState(0);
  const [firstName, setFirstName] = useState<string | undefined>();

  useEffect(() => {
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
            if (locked) {
              setDaysUntilUnlock(Math.ceil((unlockAt - Date.now()) / (24 * 60 * 60 * 1000)));
            }
          }

          // Fetch resources if we have a profile
          const profileData = d.profile;
          if (profileData) {
            setLoadingResources(true);
            try {
              const warmupData = (() => { try { return JSON.parse(localStorage.getItem("tayo_warmup") || "null"); } catch { return null; } })();
              const profileFromStorage = (() => { try { return JSON.parse(localStorage.getItem("tayo_profile") || "null"); } catch { return null; } })();
              const res = await fetch(`${BASE_URL}/api/resources`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
                body: JSON.stringify({
                  profile: profileFromStorage || { firstName: profileData.first_name },
                  warmup_data: warmupData,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                const recs: Resource[] = data.resources ?? [];
                setResources(recs);
                // Persist to localStorage for Profile resource library
                if (recs.length > 0) {
                  try {
                    const existing = JSON.parse(localStorage.getItem("tayo_resources") || "[]") as Resource[];
                    const merged = [...existing];
                    for (const r of recs) {
                      const dupe = merged.some(e => e.title === r.title);
                      if (!dupe) merged.push(r);
                    }
                    localStorage.setItem("tayo_resources", JSON.stringify(merged.slice(0, 50)));
                  } catch { /* non-fatal */ }
                }
              }
            } catch { /* silent */ }
            setLoadingResources(false);
          }
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, [getTokenAsync]);

  const markComplete = async (id: string) => {
    const tok = await getTokenAsync();
    if (!tok) return;
    try {
      await fetch(`${BASE_URL}/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ status: "complete" }),
      });
      setAssignments(a => a.map(x => x.id === id ? { ...x, status: "complete" } : x));
      setReflectionOpen(id);
      setReflectionText("");
    } catch { /* silent */ }
  };

  const saveReflection = async (id: string) => {
    const tok = await getTokenAsync();
    if (!tok || !reflectionText.trim()) return;
    setSavingReflection(true);
    try {
      await fetch(`${BASE_URL}/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ reflection: reflectionText }),
      });
      setAssignments(a => a.map(x => x.id === id ? { ...x, reflection: reflectionText } : x));
      setReflectionOpen(null);
      setReflectionText("");
    } catch { /* silent */ }
    setSavingReflection(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
        <Navbar firstName={firstName} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
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
        {/* Session banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 mb-8 flex items-center justify-between gap-4"
          style={{
            backgroundColor: sessionLocked ? "rgba(44,24,16,0.04)" : "rgba(196,98,45,0.06)",
            border: `1px solid ${sessionLocked ? "rgba(44,24,16,0.08)" : "rgba(196,98,45,0.2)"}`,
          }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "#2C1810" }}>
              {sessionLocked
                ? `Next session unlocks in ${daysUntilUnlock} ${daysUntilUnlock === 1 ? "day" : "days"}`
                : "Your next session is ready"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#9B8E84" }}>
              {sessionLocked
                ? "Use this time to work through your commitments below."
                : "Find a quiet space and give yourself 25–30 minutes."}
            </p>
          </div>
          {sessionLocked ? (
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

        {/* Assignments */}
        <div className="mb-10">
          <h2 className="font-display text-xl mb-2" style={{ color: "#2C1810" }}>Your commitments</h2>
          <p className="text-sm mb-5" style={{ color: "#746A5A" }}>What you said you'd do before your next session.</p>

          {pendingAssignments.length === 0 && completedAssignments.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
              <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>Your commitments will appear here after your first session.</p>
              <p className="text-xs" style={{ color: "#9B8E84" }}>During the session, your coach will ask you to define 1–2 things to work on.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAssignments.map(a => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: "#FFFDF8", border: "1.5px solid rgba(44,24,16,0.1)" }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => markComplete(a.id)}
                      className="mt-0.5 flex-shrink-0 transition-colors hover:opacity-70"
                      style={{ color: "rgba(44,24,16,0.25)" }}
                    >
                      <Circle className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-display text-base" style={{ color: "#2C1810" }}>{a.title}</h4>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "rgba(122,158,135,0.12)", color: "#7A9E87" }}>
                          {TYPE_LABELS[a.type] ?? a.type}
                        </span>
                      </div>
                      {a.description && <p className="text-sm mt-0.5" style={{ color: "#746A5A" }}>{a.description}</p>}
                      {a.due_date && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Clock className="w-3 h-3" style={{ color: "#9B8E84" }} />
                          <span className="text-xs" style={{ color: "#9B8E84" }}>Due {new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {reflectionOpen === a.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 ml-8 overflow-hidden"
                      >
                        <p className="text-xs font-medium mb-2" style={{ color: "#C4622D" }}>How did it go? What did you notice?</p>
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
                            disabled={savingReflection || !reflectionText.trim()}
                            className="text-xs font-semibold px-4 py-2 rounded-full disabled:opacity-40"
                            style={{ backgroundColor: "#7A9E87", color: "#F5F0E8" }}
                          >
                            {savingReflection ? "Saving…" : "Save reflection"}
                          </button>
                          <button onClick={() => setReflectionOpen(null)} className="text-xs" style={{ color: "#9B8E84" }}>Skip for now</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {completedAssignments.map(a => (
                <div
                  key={a.id}
                  className="rounded-2xl p-5 opacity-60"
                  style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.07)" }}
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#7A9E87" }} />
                    <div>
                      <h4 className="font-display text-base line-through" style={{ color: "#2C1810" }}>{a.title}</h4>
                      {a.reflection && (
                        <div className="mt-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(122,158,135,0.08)" }}>
                          <p className="text-xs" style={{ color: "#7A9E87", fontStyle: "italic" }}>"{a.reflection}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resources */}
        <div>
          <h2 className="font-display text-xl mb-2" style={{ color: "#2C1810" }}>Resources for you</h2>
          <p className="text-sm mb-5" style={{ color: "#746A5A" }}>Curated based on your profile and story.</p>

          {loadingResources ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
            </div>
          ) : resources.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
              <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>Resources will appear here after your first session.</p>
              <p className="text-xs" style={{ color: "#9B8E84" }}>They'll be tailored specifically to your story and goals.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resources.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
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
          )}
        </div>
      </main>
    </div>
  );
}
