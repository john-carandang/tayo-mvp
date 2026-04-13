import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Music, Youtube, BookOpen, ChevronRight, Image, X } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const COACH_WELCOME: Record<string, string> = {
  maya:   "Before we begin your first session, I'd love to get to know you a little. Sharing a few things about your world helps me show up for you in a way that feels personal. Take your time — or skip straight ahead if you prefer.",
  carlos: "I believe the small details of your everyday life say a lot about who you are. Before we begin, I'd love to hear about a few of them. Feel free to share as much or as little as you like.",
  aisha:  "I'm curious about you — not just the big picture, but the texture of your life right now. Before we dive in, share a few things that are part of your world. It helps me ask better questions.",
  james:  "Before your first session, I'd like to understand the context you're coming from. A few details about what's in your life right now will help me show up for you well. Share what feels right.",
};

export default function Warmup() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();

  const [music, setMusic] = useState("");
  const [youtube, setYoutube] = useState("");
  const [media, setMedia] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const coachId = localStorage.getItem("tayo_coach_id") ?? "maya";
  const coachVoiceId = localStorage.getItem("tayo_coach_voice_id") ?? undefined;
  const welcomeText = COACH_WELCOME[coachId] ?? COACH_WELCOME.maya;

  // Play voice guidance on mount
  useEffect(() => {
    let cancelled = false;
    const playVoice = async () => {
      try {
        const body: Record<string, string> = { text: welcomeText };
        if (coachVoiceId) body.voiceId = coachVoiceId;
        const res = await fetch(`${BASE_URL}/api/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audioRef.current = audio;
        audio.play().catch(() => {});
      } catch { /* non-fatal */ }
    };
    playVoice();
    return () => {
      cancelled = true;
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const addPhotoUrl = () => {
    if (photos.length < 4) setPhotos(p => [...p, ""]);
  };
  const updatePhoto = (i: number, val: string) => setPhotos(p => p.map((v, idx) => idx === i ? val : v));
  const removePhoto = (i: number) => setPhotos(p => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    audioRef.current?.pause();
    const warmupData = {
      music: music.trim() || null,
      youtube: youtube.trim() || null,
      media: media.trim() || null,
      photos: photos.filter(p => p.trim()).slice(0, 4),
    };
    try {
      const token = getToken();
      if (token) {
        await fetch(`${BASE_URL}/api/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ warmup_data: warmupData }),
        });
      }
      localStorage.setItem("tayo_warmup", JSON.stringify(warmupData));
    } catch { /* continue */ }
    setSaving(false);
    setLocation("/intake");
  };

  const skip = () => {
    audioRef.current?.pause();
    setLocation("/intake");
  };

  return (
    <div className="min-h-screen px-6 py-12" style={{ backgroundColor: "#F5F0E8" }}>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <button
            onClick={() => setLocation("/")}
            className="font-display text-xl font-semibold mb-6 block mx-auto transition-opacity hover:opacity-70"
            style={{ color: "#2C1810" }}
          >
            Tayo
          </button>
          <h1 className="font-display text-3xl mb-3" style={{ color: "#2C1810" }}>Let's warm up</h1>
          <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: "#746A5A" }}>
            {welcomeText}
          </p>
        </div>

        {/* Hero image placeholder */}
        <div
          className="w-full rounded-2xl mb-8 flex items-center justify-center"
          style={{
            height: 160,
            backgroundColor: "rgba(122,158,135,0.08)",
            border: "1.5px dashed rgba(122,158,135,0.3)",
          }}
        >
          <p className="text-xs text-center px-6" style={{ color: "rgba(122,158,135,0.6)", fontStyle: "italic" }}>
            [BIPOC photo placeholder — warm, candid, reflective moment]
          </p>
        </div>

        <div className="space-y-5 mb-10">
          {/* Photos */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(196,98,45,0.12)" }}>
                <Image className="w-4 h-4" style={{ color: "#C4622D" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "#2C1810" }}>4 photos that represent you right now</h3>
                <p className="text-xs" style={{ color: "#9B8E84" }}>Places, people, objects, anything. Paste image URLs or describe them.</p>
              </div>
            </div>
            <div className="space-y-2">
              {photos.map((photo, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={photo}
                    onChange={e => updatePhoto(i, e.target.value)}
                    placeholder={`Photo ${i + 1} URL or description`}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: "#F5F0E8", border: "1px solid rgba(44,24,16,0.15)", color: "#2C1810" }}
                  />
                  <button onClick={() => removePhoto(i)} style={{ color: "#9B8E84" }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button onClick={addPhotoUrl} className="text-xs font-medium mt-1" style={{ color: "#7A9E87" }}>
                  + Add photo
                </button>
              )}
            </div>
          </motion.div>

          {/* Music */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(122,158,135,0.12)" }}>
                <Music className="w-4 h-4" style={{ color: "#7A9E87" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "#2C1810" }}>What's on repeat lately?</h3>
                <p className="text-xs" style={{ color: "#9B8E84" }}>Your top 3 Spotify artists or the song you can't stop listening to.</p>
              </div>
            </div>
            <textarea
              value={music}
              onChange={e => setMusic(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="e.g. Kendrick Lamar, SZA, or 'Not Like Us' on repeat"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ backgroundColor: "#F5F0E8", border: "1px solid rgba(44,24,16,0.15)", color: "#2C1810" }}
            />
          </motion.div>

          {/* YouTube */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
                <Youtube className="w-4 h-4" style={{ color: "#D4A843" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "#2C1810" }}>YouTube you keep coming back to</h3>
                <p className="text-xs" style={{ color: "#9B8E84" }}>A video or channel you've been watching a lot.</p>
              </div>
            </div>
            <textarea
              value={youtube}
              onChange={e => setYoutube(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="e.g. Ali Abdaal's productivity videos, Bon Appétit"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ backgroundColor: "#F5F0E8", border: "1px solid rgba(44,24,16,0.15)", color: "#2C1810" }}
            />
          </motion.div>

          {/* Book/Show/Podcast */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(139,90,43,0.12)" }}>
                <BookOpen className="w-4 h-4" style={{ color: "#8B5A2B" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "#2C1810" }}>A book, show, or podcast on your mind</h3>
                <p className="text-xs" style={{ color: "#9B8E84" }}>Something you've been consuming or thinking about.</p>
              </div>
            </div>
            <textarea
              value={media}
              onChange={e => setMedia(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="e.g. 'The Body Keeps the Score', White Lotus, Huberman Lab"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ backgroundColor: "#F5F0E8", border: "1px solid rgba(44,24,16,0.15)", color: "#2C1810" }}
            />
          </motion.div>
        </div>

        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-base transition-all disabled:opacity-50 hover:scale-105 shadow-md"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            {saving ? "Saving…" : "Save & begin my first session"}
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={skip} className="text-sm transition-opacity hover:opacity-70" style={{ color: "#9B8E84" }}>
            Skip warm-up and begin now
          </button>
        </div>
      </div>
    </div>
  );
}
