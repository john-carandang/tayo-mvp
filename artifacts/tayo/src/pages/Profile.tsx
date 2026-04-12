import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { User, Calendar, Settings, LogOut, ChevronRight } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type ProfileTab = "overview" | "sessions" | "settings";

interface SessionSummary {
  id: string;
  session_number: number;
  created_at: string;
}

interface RemoteProfile {
  first_name?: string;
  last_name?: string;
  coach_id?: string;
  last_session_ended_at?: string;
}

const COACH_NAMES: Record<string, string> = {
  maya: "Maya",
  carlos: "Carlos",
  aisha: "Aisha",
  james: "James",
};

export default function Profile() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { signOut, getTokenAsync } = useAuth();

  const initialTab: ProfileTab = search.includes("settings") ? "settings" : "overview";
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  const [profile, setProfile] = useState<RemoteProfile | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const tok = await getTokenAsync();
        if (!tok) return;
        const [profileRes, sessionsRes] = await Promise.all([
          fetch(`${BASE_URL}/api/profile`, { headers: { Authorization: `Bearer ${tok}` } }),
          fetch(`${BASE_URL}/api/sessions`, { headers: { Authorization: `Bearer ${tok}` } }),
        ]);
        if (profileRes.ok) {
          const d = await profileRes.json();
          setProfile(d.profile ?? null);
          setFirstName(d.profile?.first_name ?? "");
          setLastName(d.profile?.last_name ?? "");
        }
        if (sessionsRes.ok) {
          const d = await sessionsRes.json();
          setSessions(d.sessions ?? []);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, [getTokenAsync]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setSaveSuccess(false);
    try {
      const tok = await getTokenAsync();
      if (!tok) return;
      await fetch(`${BASE_URL}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          first_name: firstName.trim().slice(0, 100),
          last_name: lastName.trim().slice(0, 100),
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch { /* silent */ }
    setSavingProfile(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
        <Navbar firstName={firstName || undefined} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
        </div>
      </div>
    );
  }

  const displayName = firstName.trim() || profile?.first_name || "";
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "ME";
  const coachName = profile?.coach_id ? (COACH_NAMES[profile.coach_id] ?? profile.coach_id) : null;

  const TABS: Array<{ id: ProfileTab; label: string; Icon: typeof User }> = [
    { id: "overview", label: "Overview", Icon: User },
    { id: "sessions", label: "Past Sessions", Icon: Calendar },
    { id: "settings", label: "Settings", Icon: Settings },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      <Navbar firstName={displayName || undefined} />

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center font-display text-xl font-bold"
            style={{ backgroundColor: "rgba(196,98,45,0.15)", color: "#C4622D" }}
          >
            {initials}
          </div>
          <div>
            <h1 className="font-display text-2xl" style={{ color: "#2C1810" }}>
              {displayName || "Your Profile"}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {coachName && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(122,158,135,0.12)", color: "#7A9E87" }}>
                  Coach: {coachName}
                </span>
              )}
              <span className="text-xs" style={{ color: "#9B8E84" }}>
                {sessions.length} {sessions.length === 1 ? "session" : "sessions"} completed
              </span>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={activeTab === tab.id
                ? { backgroundColor: "#C4622D", color: "#F5F0E8" }
                : { backgroundColor: "#FFFDF8", color: "#746A5A", border: "1px solid rgba(44,24,16,0.12)" }
              }
            >
              <tab.Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>

          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-6" style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}>
                <h3 className="font-display text-base mb-4" style={{ color: "#2C1810" }}>Your journey</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Sessions", value: sessions.length.toString() },
                    { label: "Coach", value: coachName ?? "—" },
                    {
                      label: "Last session",
                      value: profile?.last_session_ended_at
                        ? new Date(profile.last_session_ended_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "—"
                    },
                  ].map(stat => (
                    <div key={stat.label} className="text-center">
                      <p className="font-display text-2xl font-bold" style={{ color: "#2C1810" }}>{stat.value}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#9B8E84" }}>{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}
                onClick={() => setLocation("/dashboard")}
              >
                <div>
                  <p className="font-display text-sm font-semibold" style={{ color: "#2C1810" }}>Go to dashboard</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9B8E84" }}>View your journey, portrait, and strategic plan</p>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: "#9B8E84" }} />
              </div>

              <div
                className="rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}
                onClick={() => setLocation("/next-moves")}
              >
                <div>
                  <p className="font-display text-sm font-semibold" style={{ color: "#2C1810" }}>Next Moves</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9B8E84" }}>Your commitments and resources between sessions</p>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: "#9B8E84" }} />
              </div>
            </div>
          )}

          {/* Past sessions tab */}
          {activeTab === "sessions" && (
            <div>
              {sessions.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(122,158,135,0.08)", border: "1px dashed rgba(122,158,135,0.3)" }}>
                  <p className="text-sm font-medium mb-1" style={{ color: "#7A9E87" }}>No sessions yet.</p>
                  <p className="text-xs mb-4" style={{ color: "#9B8E84" }}>Your first session will appear here once complete.</p>
                  <button
                    onClick={() => setLocation("/intake")}
                    className="px-5 py-2 rounded-full text-sm font-semibold"
                    style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
                  >
                    Begin now
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(s => (
                    <div
                      key={s.id}
                      className="rounded-2xl p-5 flex items-center justify-between"
                      style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}
                    >
                      <div>
                        <p className="font-display text-base font-semibold" style={{ color: "#2C1810" }}>Session {s.session_number}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#9B8E84" }}>
                          {new Date(s.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <button
                        onClick={() => setLocation("/dashboard")}
                        className="text-xs font-medium px-3 py-1.5 rounded-full transition-all hover:opacity-70"
                        style={{ backgroundColor: "rgba(122,158,135,0.12)", color: "#7A9E87" }}
                      >
                        View dashboard
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings tab */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              {/* Edit name */}
              <div className="rounded-2xl p-6" style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}>
                <h3 className="font-display text-base mb-4" style={{ color: "#2C1810" }}>Your name</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "#5C4A3D" }}>First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      maxLength={100}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ backgroundColor: "#F5F0E8", border: "1.5px solid rgba(44,24,16,0.2)", color: "#2C1810" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "#5C4A3D" }}>Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      maxLength={100}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ backgroundColor: "#F5F0E8", border: "1.5px solid rgba(44,24,16,0.2)", color: "#2C1810" }}
                    />
                  </div>
                </div>
                {saveSuccess && (
                  <p className="text-xs mb-3" style={{ color: "#7A9E87" }}>Saved successfully.</p>
                )}
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
                >
                  {savingProfile ? "Saving…" : "Save changes"}
                </button>
              </div>

              {/* Change coach */}
              <div className="rounded-2xl p-6" style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}>
                <h3 className="font-display text-base mb-2" style={{ color: "#2C1810" }}>Your coach</h3>
                <p className="text-sm mb-4" style={{ color: "#746A5A" }}>
                  Currently coaching with <span className="font-semibold">{coachName ?? "no coach selected"}</span>.
                  You can change your coach at any time — it will take effect from your next session.
                </p>
                <button
                  onClick={() => setLocation("/coach")}
                  className="px-5 py-2 rounded-full text-sm font-medium transition-all hover:opacity-70"
                  style={{ backgroundColor: "rgba(122,158,135,0.12)", color: "#7A9E87" }}
                >
                  Choose a different coach
                </button>
              </div>

              {/* Sign out + delete */}
              <div className="rounded-2xl p-6" style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}>
                <h3 className="font-display text-base mb-4" style={{ color: "#2C1810" }}>Account</h3>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-sm font-medium mb-4 transition-opacity hover:opacity-70"
                  style={{ color: "#C4622D" }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs underline"
                    style={{ color: "#9B8E84" }}
                  >
                    Request data deletion
                  </button>
                ) : (
                  <div className="p-4 rounded-xl" style={{ backgroundColor: "rgba(196,98,45,0.06)", border: "1px solid rgba(196,98,45,0.15)" }}>
                    <p className="text-sm mb-3" style={{ color: "#2C1810" }}>To request deletion of your account and all data, please email us at <span className="font-medium">privacy@tayo.ai</span>. We'll process your request within 30 days.</p>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-xs"
                      style={{ color: "#9B8E84" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
