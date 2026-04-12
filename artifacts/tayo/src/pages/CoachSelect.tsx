import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Volume2, Check } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const COACHES = [
  {
    id: "maya",
    name: "Maya",
    tags: ["Warm", "Direct", "Strength-based"],
    bio: "Maya has a gift for seeing your strengths before you do. She reflects back what's working and helps you build from there — honestly and without sugarcoating.",
    voiceId: "XeomjLZoU5rr4yNIg16w",
    accent: "#C4622D",
    initial: "M",
  },
  {
    id: "carlos",
    name: "Carlos",
    tags: ["Grounded", "Reflective", "Patient"],
    bio: "Carlos believes the answers are already in you. He slows things down, creates space to think, and asks the questions that help you hear your own wisdom.",
    voiceId: "1fz2mW1imKTf5Ryjk5su",
    accent: "#7A9E87",
    initial: "C",
  },
  {
    id: "aisha",
    name: "Aisha",
    tags: ["Curious", "Incisive", "Energising"],
    bio: "Aisha cuts straight to what matters. She'll ask the question that cracks something open — and make the whole process feel alive and forward-moving.",
    voiceId: "zwbQ2XUiIlOKD6b3JWXd",
    accent: "#D4A843",
    initial: "A",
  },
  {
    id: "james",
    name: "James",
    tags: ["Calm", "Structured", "Encouraging"],
    bio: "James brings steadiness to complexity. He helps you break down the overwhelming into clear steps, and trusts you to take them in your own time.",
    voiceId: "ePEc9tlhrIO7VRkiOlQN",
    accent: "#8B5A2B",
    initial: "J",
  },
];

export default function CoachSelect() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playVoice = async (coach: typeof COACHES[0]) => {
    if (playingVoice === coach.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingVoice(null);
      return;
    }
    setPlayingVoice(coach.id);
    try {
      const res = await fetch(`${BASE_URL}/api/coach-sample`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: coach.voiceId }),
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.play();
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => setPlayingVoice(null);
    } catch {
      setPlayingVoice(null);
    }
  };

  const handleContinue = async () => {
    if (!selected) return;
    const coach = COACHES.find(c => c.id === selected);
    if (!coach) return;
    setSaving(true);
    try {
      const token = getToken();
      if (token) {
        await fetch(`${BASE_URL}/api/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ coach_id: coach.id, coach_voice_id: coach.voiceId }),
        });
      }
      localStorage.setItem("tayo_coach_voice_id", coach.voiceId);
      localStorage.setItem("tayo_coach_id", coach.id);
    } catch { /* continue */ }
    setSaving(false);
    setLocation("/warmup");
  };

  return (
    <div className="min-h-screen px-6 py-12" style={{ backgroundColor: "#F5F0E8" }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <button
            onClick={() => setLocation("/")}
            className="font-display text-xl font-semibold mb-6 block mx-auto transition-opacity hover:opacity-70"
            style={{ color: "#2C1810" }}
          >
            Tayo
          </button>
          <h1 className="font-display text-3xl mb-3" style={{ color: "#2C1810" }}>Choose your coach</h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: "#746A5A" }}>
            You'll work with this coach throughout your Tayo journey. Hear each voice before you decide.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
          {COACHES.map((coach, i) => (
            <motion.div
              key={coach.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setSelected(coach.id)}
              className="rounded-2xl p-6 cursor-pointer transition-all relative"
              style={{
                backgroundColor: "#FFFDF8",
                border: `2px solid ${selected === coach.id ? coach.accent : "rgba(44,24,16,0.1)"}`,
                boxShadow: selected === coach.id ? `0 4px 20px ${coach.accent}30` : "0 2px 8px rgba(44,24,16,0.04)",
                transform: selected === coach.id ? "scale(1.02)" : "scale(1)",
              }}
            >
              {selected === coach.id && (
                <div
                  className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: coach.accent }}
                >
                  <Check className="w-3.5 h-3.5" style={{ color: "#F5F0E8" }} />
                </div>
              )}

              {/* Portrait placeholder */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 font-display text-2xl font-bold"
                style={{
                  backgroundColor: `${coach.accent}18`,
                  color: coach.accent,
                  border: `1.5px solid ${coach.accent}25`,
                }}
              >
                {coach.initial}
              </div>

              <h3 className="font-display text-lg mb-1.5" style={{ color: "#2C1810" }}>{coach.name}</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {coach.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${coach.accent}12`, color: coach.accent }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "#746A5A" }}>{coach.bio}</p>
              <button
                onClick={e => { e.stopPropagation(); playVoice(coach); }}
                className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                style={{ backgroundColor: `${coach.accent}12`, color: coach.accent }}
              >
                <Volume2 className="w-3.5 h-3.5" />
                {playingVoice === coach.id ? "Playing… (tap to stop)" : "Hear my voice"}
              </button>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={handleContinue}
            disabled={!selected || saving}
            className="px-10 py-4 rounded-full font-semibold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 shadow-md"
            style={{ backgroundColor: selected ? "#C4622D" : "#9B8E84", color: "#F5F0E8" }}
          >
            {saving ? "Saving…" : selected
              ? `Continue with ${COACHES.find(c => c.id === selected)?.name}`
              : "Select a coach to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
