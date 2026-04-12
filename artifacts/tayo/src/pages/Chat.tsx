import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile, useChatHistory } from "@/hooks/use-tayo-state";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ChevronRight, Clock } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const SESSION_DURATION_MS = 30 * 60 * 1000;
const GRACEFUL_CLOSE_MS = 28 * 60 * 1000;

const COACHING_RULES = `COACHING BEHAVIOR RULES — FOLLOW EXACTLY:

1. OPENING: Open with a warm welcome. For Session 2+, briefly reference one key theme or commitment from the last session as a warm bridge, then ask: "What's top of mind for you today?"

2. QUESTION DISCIPLINE: Ask exactly one question per turn. Never stack questions. Never repeat a question verbatim. If the user says stop or moves on, honor that permanently.

3. TURN LENGTH: Keep responses short, warm, and precise. Restate what you heard in one sentence, then ask your next question. No preambles. No filler. No prescriptive advice.

4. NO ASSUMPTIONS: Do not assume anything about the user's life circumstances unless explicitly stated or at least 70% confidence from prior responses.

5. FOLLOW THE USER: When the user redirects, follow them. Ask "Oh interesting — why?" gently. Do not redirect back to your original question.

6. PRECISION PLAYBACK: Regularly reflect back what you are hearing — including incomplete thoughts, contradictions, and patterns. This is the most valuable thing you do.

7. NON-SYCOPHANTIC: Never agree just to agree. Probe gently when something deserves more examination. Do not foster dependency on Tayo.

8. STRENGTH-BASED: Frame challenges as design problems — natural friction from their values and circumstances — not failures.

9. CLINICAL BOUNDARY: If the user shows clinical concern signals, acknowledge warmly and refer: "What you're sharing sounds like it may benefit from professional support beyond coaching. I'd encourage you to speak with a mental health professional."

10. CULTURAL TOUCHPOINTS: Weave in light questions about music, shows, podcasts, books — natural trust-builders.

11. SESSION CLOSE: When signalled to close, summarize 2–3 key themes warmly, then ask: "Before we close — what's one thing you'll do before we talk again?" Then: "How will you know you've followed through?"

12. FORMAT: Never use markdown formatting — no asterisks, hashtags, bullet symbols, numbered lists. Plain warm prose only.

ICF FRAMEWORK: Grounded in ICF Core Competencies (2025) and Co-Active Coaching. The client is naturally creative, resourceful, and whole.`;

function cleanText(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
}

async function speakText(text: string, voiceId?: string): Promise<HTMLAudioElement> {
  const cleaned = cleanText(text);
  const body: Record<string, string> = { text: cleaned };
  if (voiceId) body.voiceId = voiceId;
  const res = await fetch(`${BASE_URL}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  return new Audio(URL.createObjectURL(blob));
}

async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  const res = await fetch(`${BASE_URL}/api/transcribe`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Transcription failed");
  const data = await res.json();
  return data.text || "";
}

async function chatWithAI(messages: Array<{ role: string; content: string }>, systemPrompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt }),
  });
  if (!res.ok) throw new Error("Chat failed");
  const data = await res.json();
  return data.response || "";
}

function formatTime(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function Chat() {
  const [, setLocation] = useLocation();
  const { profile, isHydrated } = useTayoProfile();
  const { history, setHistory } = useChatHistory();
  const { getToken } = useAuth();

  const [voiceState, setVoiceState] = useState<"IDLE" | "AI_SPEAKING" | "USER_PROMPT" | "USER_RECORDING" | "PROCESSING" | "ERROR" | "CLOSING">("IDLE");
  const [currentAiText, setCurrentAiText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(SESSION_DURATION_MS);
  const [gracefulCloseTriggered, setGracefulCloseTriggered] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackCancelRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const historyRef = useRef(history);
  historyRef.current = history;

  const coachVoiceId = localStorage.getItem("tayo_coach_voice_id") || undefined;

  useEffect(() => {
    if (isHydrated && !profile) setLocation("/");
  }, [isHydrated, profile, setLocation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Session timer
  useEffect(() => {
    if (sessionEnded) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - sessionStartRef.current;
      const remaining = SESSION_DURATION_MS - elapsed;
      setTimeRemaining(remaining);

      if (elapsed >= GRACEFUL_CLOSE_MS && !gracefulCloseTriggered) {
        setGracefulCloseTriggered(true);
      }
      if (elapsed >= SESSION_DURATION_MS) {
        clearInterval(interval);
        handleSessionEnd();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionEnded, gracefulCloseTriggered]);

  const buildSystemPrompt = useCallback((isClosing = false) => {
    if (!profile) return "";
    const topDim = [...profile.dimensions].sort((a, b) => b.importance - a.importance)[0];

    return `You are Tayo, a warm and incisive life coach. The user's name is ${profile.firstName}.

${history.length === 0 ? `Your very first message: Welcome ${profile.firstName} back warmly by name. Tell them this session is for going deeper — making sense of what their journey revealed, exploring what matters most, and preparing for action. Tell them they have about 30 minutes. Then ask: "What's top of mind for you today?"` : ""}

Full life profile (JSON):
${JSON.stringify(profile, null, 2).slice(0, 8000)}

${isClosing ? `IMPORTANT: The session is nearing its end. Summarize 2–3 key themes from this conversation in warm, precise language. Then ask: "Before we close — what's one thing you'll do before we talk again?" And then: "How will you know you've followed through?"` : `Your role: Help ${profile.firstName} go deeper — clarify what they want, explore what their dashboard revealed. Reference their actual dimensions, values, life events. Direct and specific.`}

${COACHING_RULES}`;
  }, [profile, history]);

  const stopAudio = useCallback(() => {
    playbackCancelRef.current = true;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  const playAI = useCallback(async (text: string) => {
    stopAudio();
    playbackCancelRef.current = false;
    setCurrentAiText(text);
    setVoiceState("AI_SPEAKING");

    const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
    if (sentences.length === 0) { setVoiceState("USER_PROMPT"); return; }

    const audioPromises = sentences.map(s => speakText(s, coachVoiceId).catch(() => null));

    for (const promise of audioPromises) {
      if (playbackCancelRef.current) break;
      try {
        const audio = await promise;
        if (!audio) continue;
        if (playbackCancelRef.current) break;
        audioRef.current = audio;
        await new Promise<void>(resolve => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          const p = audio.play();
          if (p !== undefined) p.catch(() => resolve());
        });
      } catch { /* continue */ }
    }

    if (!playbackCancelRef.current) setVoiceState("USER_PROMPT");
  }, [stopAudio, coachVoiceId]);

  const handleSessionEnd = useCallback(async () => {
    if (sessionEnded) return;
    setSessionEnded(true);
    stopAudio();

    const token = getToken();
    if (token && historyRef.current.length > 0) {
      try {
        const transcript = historyRef.current.map(m => `${m.role === "user" ? profile?.firstName ?? "User" : "Tayo"}: ${m.content}`).join("\n\n");
        await fetch(`${BASE_URL}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ transcript, profile_json: profile, commitments: [] }),
        });
      } catch { /* non-fatal */ }
    }
  }, [sessionEnded, profile, getToken, stopAudio]);

  // Auto-greet
  useEffect(() => {
    if (!isHydrated || !profile || history.length > 0) return;
    const greet = async () => {
      setVoiceState("PROCESSING");
      try {
        const greeting = await chatWithAI(
          [{ role: "user", content: `Hello, I've completed my intake. I'm ready to go deeper.` }],
          buildSystemPrompt()
        );
        const newHistory = [{ role: "assistant", content: greeting }];
        setHistory(newHistory);
        await playAI(greeting);
      } catch {
        setVoiceState("USER_PROMPT");
      }
    };
    greet();
  }, [isHydrated, profile]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceState("PROCESSING");
        try {
          const text = await transcribeAudio(blob);
          if (!text.trim()) { setVoiceState("USER_PROMPT"); return; }

          const userMsg = { role: "user", content: text };
          const updatedHistory = [...history, userMsg];
          setHistory(updatedHistory);

          const isClosing = gracefulCloseTriggered;
          const aiResponse = await chatWithAI(updatedHistory, buildSystemPrompt(isClosing));
          const assistantMsg = { role: "assistant", content: aiResponse };
          setHistory([...updatedHistory, assistantMsg]);
          await playAI(aiResponse);
        } catch {
          setVoiceState("ERROR");
          setErrorMsg("Something went wrong. Tap to retry.");
        }
      };

      recorder.start();
      setVoiceState("USER_RECORDING");
    } catch {
      setVoiceState("ERROR");
      setErrorMsg("Microphone access denied.");
    }
  }, [history, buildSystemPrompt, setHistory, playAI, gracefulCloseTriggered]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      setVoiceState("PROCESSING");
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleOrbClick = useCallback(() => {
    if (voiceState === "USER_PROMPT") startRecording();
    else if (voiceState === "USER_RECORDING") stopRecording();
    else if (voiceState === "AI_SPEAKING") { stopAudio(); setVoiceState("USER_PROMPT"); }
    else if (voiceState === "ERROR") { setVoiceState("USER_PROMPT"); setErrorMsg(""); }
  }, [voiceState, startRecording, stopRecording, stopAudio]);

  const handleGoToDashboard = useCallback(async () => {
    if (!profile) return;
    setIsGeneratingPlan(true);
    stopAudio();
    try {
      const token = getToken();
      if (token) {
        await fetch(`${BASE_URL}/api/dashboard-snapshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ profile_json: profile }),
        });
      }
    } catch { /* non-fatal */ }
    setIsGeneratingPlan(false);
    setLocation("/dashboard");
  }, [profile, setLocation, stopAudio, getToken]);

  const orbStateDisplay: OrbState =
    voiceState === "AI_SPEAKING" ? "speaking" :
    voiceState === "USER_RECORDING" ? "listening" :
    voiceState === "PROCESSING" ? "processing" : "idle";

  const orbLabel =
    voiceState === "AI_SPEAKING" ? "Tap to skip" :
    voiceState === "USER_PROMPT" ? "Tap to speak" :
    voiceState === "USER_RECORDING" ? "Tap when done" :
    voiceState === "PROCESSING" ? "Tayo is thinking…" :
    voiceState === "ERROR" ? "Tap to retry" : "";

  if (!isHydrated || !profile) return null;

  // Session ended
  if (sessionEnded) {
    return (
      <StepLayout step={3} title="Session Complete">
        <div className="flex flex-col items-center gap-6 pt-8 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(122,158,135,0.15)" }}>
              <CheckIcon />
            </div>
          </motion.div>
          <h2 className="font-display text-2xl" style={{ color: "#2C1810" }}>We've reached the end of our time together today.</h2>
          <p className="text-sm max-w-sm" style={{ color: "#746A5A" }}>Your session has been saved. Head back to your dashboard to see how it's evolved.</p>
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            View your dashboard
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </StepLayout>
    );
  }

  return (
    <StepLayout step={3} title="Coaching Session" description="Go deeper with Tayo — explore what your journey reveals and prepare to move with clarity.">
      <div className="flex flex-col items-center gap-6">

        {/* Timer */}
        <div className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full",
          timeRemaining < 5 * 60 * 1000 ? "bg-red-50 text-red-600" : gracefulCloseTriggered ? "bg-amber-50 text-amber-600" : "text-muted-foreground"
        )}>
          <Clock className="w-3.5 h-3.5" />
          {gracefulCloseTriggered ? `Wrapping up — ${formatTime(timeRemaining)} left` : formatTime(timeRemaining)}
        </div>

        {gracefulCloseTriggered && !sessionEnded && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="text-center px-4 py-3 rounded-xl text-sm max-w-sm"
            style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#8B5A2B", fontStyle: "italic" }}>
            We're nearing the end of our session. Tayo will begin wrapping up.
          </motion.div>
        )}

        {/* Chat history */}
        {history.length > 0 && (
          <div className="w-full max-w-lg space-y-3 max-h-72 overflow-y-auto pr-1">
            {history.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-xs sm:max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "card-warm text-foreground rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Speaking text */}
        <AnimatePresence mode="wait">
          {voiceState === "AI_SPEAKING" && currentAiText && (
            <motion.p key={currentAiText} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-sm text-center text-muted-foreground max-w-sm px-4 italic">
              "{currentAiText}"
            </motion.p>
          )}
        </AnimatePresence>

        <VoiceOrb state={orbStateDisplay} size={100} onClick={handleOrbClick} label={orbLabel} />

        {errorMsg && <p className="text-sm text-destructive text-center">{errorMsg}</p>}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 items-center mt-2">
          {history.filter(m => m.role === "user").length >= 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <button
                onClick={handleGoToDashboard}
                disabled={isGeneratingPlan}
                className="flex items-center gap-2 px-6 py-3 border-2 rounded-full font-semibold text-sm hover:opacity-80 transition-all disabled:opacity-50"
                style={{ borderColor: "#C4622D", color: "#C4622D" }}
              >
                {isGeneratingPlan ? (
                  <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Updating your dashboard…</>
                ) : (
                  <>Update my dashboard <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </motion.div>
          )}
          <button
            onClick={handleSessionEnd}
            className="text-xs"
            style={{ color: "#9B8E84" }}
          >
            End session early
          </button>
        </div>
      </div>
    </StepLayout>
  );
}

function CheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M6 16L12 22L26 10" stroke="#7A9E87" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
