import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile, type TayoProfile } from "@/hooks/use-tayo-state";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type VoiceState = "LOADING" | "AI_SPEAKING" | "USER_PROMPT" | "USER_RECORDING" | "PROCESSING" | "ERROR" | "EXTRACTING";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PHASE_LABELS = ["Welcome", "Your Story", "Life Areas", "Values", "Purpose", "Closing"];

const COACHING_RULES = `COACHING BEHAVIOR RULES:
1. OPENING: Welcome the user warmly. Ask "What's top of mind for you today?" Do not set the agenda.
2. QUESTION DISCIPLINE: Ask exactly one question per turn. Never stack questions.
3. TURN LENGTH: Keep responses short and warm — 2-3 sentences max. Restate what you heard, then ask your next question.
4. NO ASSUMPTIONS: Do not assume anything about the user's circumstances unless they've stated it.
5. FOLLOW THE USER: When the user redirects, follow them. Ask "Oh interesting — why?" gently.
6. PRECISION PLAYBACK: Reflect back what you hear — including patterns and contradictions the user may not have noticed.
7. NON-SYCOPHANTIC: Never just agree. Probe gently when something deserves more examination.
8. STRENGTH-BASED: Frame challenges as design problems — natural friction from their values and circumstances.
9. CLINICAL BOUNDARY: If the user shows signs of clinical concern, acknowledge warmly and refer to professional support. Do not coach through clinical material.
10. CULTURAL TOUCHPOINTS: Weave in light questions about music, shows, podcasts, books — natural trust-builders.
11. NO CHART REFERENCES: Never reference a chart, graph, dashboard, or visual tool during this voice conversation. The user cannot see any visuals.
12. FORMAT: Never use markdown formatting. Plain prose only — no asterisks, hashtags, bullets, or numbered lists.`;

function buildSystemPrompt(warmupData: Record<string, unknown> | null): string {
  const warmupContext = warmupData ? `
Warm-up context (weave naturally into conversation — do not read it like a checklist):
- Music they're into: ${warmupData.music || "not shared"}
- YouTube they watch: ${warmupData.youtube || "not shared"}
- Media on their mind: ${warmupData.media || "not shared"}
- Photos representing them: ${warmupData.photos ? (warmupData.photos as string[]).join(", ") : "not shared"}
` : "";

  return `You are Tayo, a warm and perceptive life coach conducting a voice intake conversation with a new client. This is Session 1.

Your goal is inquiry and relationship-building — go deep on whatever the user brings. Build trust first. The coaching dashboard will populate from whatever you gather, and you'll both return to add more over time.

${warmupContext}

Your very first message: Welcome the user warmly to Tayo. Tell them this is a space to think out loud about their life — their story, what matters, what they're navigating. Tell them to plan for 15–20 minutes and that the more openly they share, the richer their insights. Then ask: "What's top of mind for you today?"

Over the course of this conversation, gently explore (in whatever order feels natural):
- Their life story and key chapters — highs, lows, turning points
- How different areas of their life are going: work, relationships, health, emotional wellbeing, finances
- What they value most and what gives them meaning
- What they sense they're here to do or become
- Anything else they feel is important to share

${COACHING_RULES}

ICF FRAMEWORK: Your coaching is grounded in ICF Core Competencies (2025) and Co-Active principles. The client is naturally creative, resourceful, and whole.`;
}

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
  return (data.text as string) || "";
}

async function chatWithAI(messages: Message[], systemPrompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt }),
  });
  if (!res.ok) throw new Error("Chat failed");
  const data = await res.json();
  return (data.response as string) || "";
}

async function extractProfile(conversationText: string, firstName: string): Promise<TayoProfile> {
  const res = await fetch(`${BASE_URL}/api/extract-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationText, firstName }),
  });
  if (!res.ok) throw new Error("Profile extraction failed");
  const data = await res.json();
  return data.profile as TayoProfile;
}

export default function Intake() {
  const [, setLocation] = useLocation();
  const { setProfile } = useTayoProfile();
  const { getToken } = useAuth();

  const [voiceState, setVoiceState] = useState<VoiceState>("LOADING");
  const [phase, setPhase] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [extractError, setExtractError] = useState(false);
  const [extractStatus, setExtractStatus] = useState("Building your profile…");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackCancelRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const phaseRef = useRef(0);

  const coachVoiceId = localStorage.getItem("tayo_coach_voice_id") || undefined;
  const warmupRaw = localStorage.getItem("tayo_warmup");
  const warmupData: Record<string, unknown> | null = warmupRaw ? JSON.parse(warmupRaw) : null;
  const systemPrompt = buildSystemPrompt(warmupData);

  const stopAudio = useCallback(() => {
    playbackCancelRef.current = true;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  const playAI = useCallback(async (text: string): Promise<void> => {
    stopAudio();
    playbackCancelRef.current = false;
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
          setTimeout(resolve, 30000);
        });
      } catch { /* continue */ }
    }

    if (!playbackCancelRef.current) setVoiceState("USER_PROMPT");
  }, [stopAudio, coachVoiceId]);

  const addMessage = useCallback((msg: Message) => {
    const updated = [...messagesRef.current, msg];
    messagesRef.current = updated;
    setMessages(updated);
    return updated;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const greet = async () => {
      try {
        const greeting = await chatWithAI(
          [{ role: "user", content: "Hello, I'm ready to begin my Tayo session." }],
          systemPrompt
        );
        if (cancelled) return;
        const msg: Message = { role: "assistant", content: greeting };
        messagesRef.current = [msg];
        setMessages([msg]);
        await playAI(greeting);
      } catch {
        if (!cancelled) { setVoiceState("ERROR"); setErrorMsg("Failed to connect. Tap to retry."); }
      }
    };
    greet();
    return () => { cancelled = true; };
  }, []);

  const doExtractProfile = useCallback(async () => {
    setVoiceState("EXTRACTING");
    setExtractError(false);
    setExtractStatus("Analysing your conversation…");

    try {
      const conversationText = messagesRef.current
        .map(m => `${m.role === "user" ? "User" : "Tayo"}: ${m.content}`)
        .join("\n\n");

      const profile = await extractProfile(conversationText, "");
      setProfile(profile);
      setExtractStatus("Building your dashboard…");

      const token = getToken();
      if (token) {
        try {
          await fetch(`${BASE_URL}/api/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ transcript: conversationText, profile_json: profile, commitments: [] }),
          });
          await fetch(`${BASE_URL}/api/dashboard-snapshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ profile_json: profile }),
          });
        } catch { /* non-fatal — localStorage backup already set */ }
      }

      setLocation("/dashboard");
    } catch {
      setVoiceState("USER_PROMPT");
      setExtractError(true);
    }
  }, [setProfile, setLocation, getToken]);

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

          const userMsg: Message = { role: "user", content: text };
          const updatedMessages = addMessage(userMsg);
          const currentPhase = phaseRef.current;
          const nextPhase = Math.min(currentPhase + 1, PHASE_LABELS.length - 1);

          if (nextPhase >= PHASE_LABELS.length - 1 && currentPhase >= 4) {
            const closingPrompt = `${systemPrompt}

This is a natural closing point. Respond warmly (1-2 sentences) acknowledging what the user shared, and let them know their profile is now being prepared. Make it feel like a meaningful moment.`;
            const aiResponse = await chatWithAI(updatedMessages, closingPrompt);
            addMessage({ role: "assistant", content: aiResponse });
            await playAI(aiResponse);
            await doExtractProfile();
            return;
          }

          const aiResponse = await chatWithAI(updatedMessages, systemPrompt);
          addMessage({ role: "assistant", content: aiResponse });
          phaseRef.current = nextPhase;
          setPhase(nextPhase);
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
  }, [addMessage, playAI, doExtractProfile, systemPrompt]);

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

  const orbState: OrbState =
    voiceState === "LOADING" || voiceState === "PROCESSING" || voiceState === "EXTRACTING" ? "processing" :
    voiceState === "AI_SPEAKING" ? "speaking" :
    voiceState === "USER_RECORDING" ? "listening" : "idle";

  const orbLabel =
    voiceState === "LOADING" ? "Connecting…" :
    voiceState === "EXTRACTING" ? extractStatus :
    voiceState === "AI_SPEAKING" ? "Tap to skip" :
    voiceState === "USER_PROMPT" ? "Tap to speak" :
    voiceState === "USER_RECORDING" ? "Tap when done" :
    voiceState === "PROCESSING" ? "Tayo is thinking…" :
    voiceState === "ERROR" ? "Tap to retry" : "";

  const hasEnoughForExtraction = messagesRef.current.filter(m => m.role === "user").length >= 3;

  return (
    <StepLayout
      step={1}
      title="Your Voice Intake"
      description="Speak openly — your story, what matters, what you're navigating. Tayo will listen and ask what opens things up. Plan for around 15–20 minutes."
    >
      <div className="flex flex-col items-center gap-6 pt-6">
        {/* Phase progress */}
        {messages.length > 0 && voiceState !== "EXTRACTING" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
            {PHASE_LABELS.map((_, i) => (
              <div key={i} className={cn("rounded-full transition-all duration-300",
                i < phase ? "w-2 h-2 bg-primary" :
                i === phase ? "w-6 h-2 bg-primary" :
                "w-2 h-2 bg-foreground/15"
              )} />
            ))}
            <span className="text-xs text-muted-foreground ml-2">{PHASE_LABELS[Math.min(phase, PHASE_LABELS.length - 1)]}</span>
          </motion.div>
        )}

        {/* Voice Orb */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <VoiceOrb
            state={orbState}
            size={160}
            onClick={handleOrbClick}
            label={orbLabel}
            disabled={voiceState === "LOADING" || voiceState === "PROCESSING" || voiceState === "EXTRACTING"}
          />
        </motion.div>

        {voiceState === "EXTRACTING" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
            <p className="text-base font-medium text-foreground">{extractStatus}</p>
            <p className="text-sm text-muted-foreground">Your dashboard will be ready in a moment.</p>
          </motion.div>
        )}

        {extractError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <p className="text-sm text-destructive">Failed to build profile.</p>
            <button onClick={doExtractProfile} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </motion.div>
        )}

        {voiceState === "ERROR" && errorMsg && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive text-center max-w-sm px-4">
            {errorMsg}
          </motion.p>
        )}

        {/* Wrap up early button */}
        {hasEnoughForExtraction && voiceState === "USER_PROMPT" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              onClick={doExtractProfile}
              className="text-xs text-muted-foreground underline"
            >
              I've shared enough — build my dashboard
            </button>
          </motion.div>
        )}

        {/* Transcript */}
        <AnimatePresence>
          {messages.length > 0 && voiceState !== "EXTRACTING" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
              <div className="card-warm p-4 space-y-3 max-h-52 overflow-y-auto">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-xs rounded-2xl px-4 py-2.5 text-xs leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-background/60 border border-border text-foreground rounded-tl-sm"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StepLayout>
  );
}
