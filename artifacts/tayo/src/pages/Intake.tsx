import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile, type TayoProfile } from "@/hooks/use-tayo-state";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

type VoiceState = "LOADING" | "AI_SPEAKING" | "USER_PROMPT" | "USER_RECORDING" | "PROCESSING" | "ERROR" | "EXTRACTING";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PHASE_QUESTIONS = [
  "What is your name, and how would you describe where you are in life in just a few words right now?",
  "Tell me about the arc of the last few years — what chapters have you moved through, what changed, and where do you find yourself today?",
  "Walk me through how you're doing across different areas of your life: your work, relationships, physical health, emotional state, and finances. What's thriving, what's a struggle, and what matters most?",
  "When you think about what you value most deeply — the principles that guide your best decisions and give your life meaning — what comes to mind?",
  "Here's the bigger question: what do you sense you're here to do? What kind of impact do you want to have, and what legacy do you want to leave?",
  "Is there anything else — something you haven't shared yet — that feels important for me to know as I build your profile?"
];

const PHASE_LABELS = ["Introduction", "Your Story", "Life Areas", "Values", "Purpose", "Final Thoughts"];

const SYSTEM_PROMPT = `You are Tayo, a warm, perceptive life coach conducting a voice intake conversation.
Your goal across 6 phases is to deeply understand the user's current life situation, key life events, values, and sense of purpose.
- Be genuinely curious and empathetic
- Keep responses conversational and warm — 2-4 sentences max
- Do not number responses or mention phase numbers`;

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

  const [voiceState, setVoiceState] = useState<VoiceState>("LOADING");
  const [phase, setPhase] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [extractError, setExtractError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const transcriptRef = useRef<string[]>([]);
  const phaseRef = useRef(0);

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  };

  const playAI = useCallback(async (text: string): Promise<void> => {
    stopAudio();
    setVoiceState("AI_SPEAKING");
    return new Promise((resolve) => {
      speakText(text)
        .then((audio) => {
          audioRef.current = audio;
          // Try auto-play (may fail without prior user gesture)
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Autoplay blocked — still show AI text, transition to prompt state
            });
          }
          audio.onended = () => { setVoiceState("USER_PROMPT"); resolve(); };
          audio.onerror = () => { setVoiceState("USER_PROMPT"); resolve(); };
          // Safety timeout
          setTimeout(() => {
            if (voiceState === "AI_SPEAKING") { setVoiceState("USER_PROMPT"); resolve(); }
          }, 30000);
        })
        .catch(() => {
          setVoiceState("USER_PROMPT");
          resolve();
        });
    });
  }, []);

  const addMessage = useCallback((msg: Message) => {
    const updated = [...messagesRef.current, msg];
    messagesRef.current = updated;
    setMessages(updated);
    return updated;
  }, []);

  // Auto-greet on mount — call /api/chat immediately
  useEffect(() => {
    let cancelled = false;
    const greet = async () => {
      try {
        const openingPrompt = `You are Tayo, a warm life coach beginning a voice intake session. 
Introduce yourself warmly in 1 sentence, then ask: "${PHASE_QUESTIONS[0]}"
Be natural and welcoming.`;
        const greeting = await chatWithAI(
          [{ role: "user", content: "Hello, I'm starting my intake session with Tayo." }],
          openingPrompt
        );
        if (cancelled) return;
        const msg: Message = { role: "assistant", content: greeting };
        messagesRef.current = [msg];
        setMessages([msg]);
        await playAI(greeting);
      } catch {
        if (!cancelled) {
          setVoiceState("ERROR");
          setErrorMsg("Failed to connect. Please tap to retry.");
        }
      }
    };
    greet();
    return () => { cancelled = true; };
  }, []);

  const doExtractProfile = useCallback(async () => {
    setVoiceState("EXTRACTING");
    setExtractError(false);
    try {
      const conversationText = messagesRef.current
        .map(m => `${m.role === "user" ? "User" : "Tayo"}: ${m.content}`)
        .join("\n\n");
      // Let Claude extract the firstName from the conversation — don't guess from tokens
      const profile = await extractProfile(conversationText, "");
      setProfile(profile);
      setLocation("/dashboard");
    } catch {
      setVoiceState("USER_PROMPT");
      setExtractError(true);
    }
  }, [setProfile, setLocation]);

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
          const updatedTranscript = [...transcriptRef.current, text];
          transcriptRef.current = updatedTranscript;
          setTranscript(updatedTranscript);

          const currentPhase = phaseRef.current;
          const nextPhase = currentPhase + 1;

          if (nextPhase >= PHASE_QUESTIONS.length) {
            const closingPrompt = `${SYSTEM_PROMPT}
This is the final phase. Respond warmly (1-2 sentences) and let the user know their profile is being built.`;
            const aiResponse = await chatWithAI(updatedMessages, closingPrompt);
            addMessage({ role: "assistant", content: aiResponse });
            await playAI(aiResponse);
            await doExtractProfile();
            return;
          }

          const transitionPrompt = `${SYSTEM_PROMPT}
Respond warmly to what the user said (1-2 sentences), then ask: "${PHASE_QUESTIONS[nextPhase]}"
Do NOT mention phase numbers.`;
          const aiResponse = await chatWithAI(updatedMessages, transitionPrompt);
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
  }, [addMessage, playAI, doExtractProfile]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }, []);

  const handleOrbClick = useCallback(() => {
    if (voiceState === "USER_PROMPT") startRecording();
    else if (voiceState === "USER_RECORDING") stopRecording();
    else if (voiceState === "AI_SPEAKING") { stopAudio(); setVoiceState("USER_PROMPT"); }
    else if (voiceState === "ERROR") { setVoiceState("USER_PROMPT"); setErrorMsg(""); }
  }, [voiceState, startRecording, stopRecording]);

  const orbState: OrbState =
    voiceState === "LOADING" || voiceState === "PROCESSING" ? "processing" :
    voiceState === "EXTRACTING" ? "processing" :
    voiceState === "AI_SPEAKING" ? "speaking" :
    voiceState === "USER_RECORDING" ? "listening" : "idle";

  const orbLabel =
    voiceState === "LOADING" ? "Connecting…" :
    voiceState === "EXTRACTING" ? "Building profile…" :
    voiceState === "AI_SPEAKING" ? "Tap to skip" :
    voiceState === "USER_PROMPT" ? "Tap to speak" :
    voiceState === "USER_RECORDING" ? "Tap when done" :
    voiceState === "PROCESSING" ? "Processing…" :
    voiceState === "ERROR" ? "Tap to retry" : "";

  return (
    <StepLayout step={1} title="Your Voice Intake" subtitle="A guided conversation to understand where you are in life.">
      <div className="flex flex-col items-center gap-6 pt-6">

        {/* Phase progress */}
        {messages.length > 0 && voiceState !== "EXTRACTING" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
            {PHASE_QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i < phase ? "w-2 h-2 bg-primary" :
                  i === phase ? "w-6 h-2 bg-primary" :
                  "w-2 h-2 bg-foreground/15"
                )}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {PHASE_LABELS[Math.min(phase, PHASE_QUESTIONS.length - 1)]}
            </span>
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

        {/* Extracting state */}
        {voiceState === "EXTRACTING" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
            <p className="text-base font-medium text-foreground">Building your profile…</p>
            <p className="text-sm text-muted-foreground">Analysing your conversation and preparing your dashboard.</p>
          </motion.div>
        )}

        {/* Extraction retry */}
        {extractError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <p className="text-sm text-destructive">Failed to build profile.</p>
            <button
              onClick={doExtractProfile}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </motion.div>
        )}

        {/* Error */}
        {voiceState === "ERROR" && errorMsg && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive text-center max-w-sm px-4">
            {errorMsg}
          </motion.p>
        )}

        {/* Full bidirectional transcript — all turns */}
        <AnimatePresence>
          {messages.length > 0 && voiceState !== "EXTRACTING" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-lg"
            >
              <div className="card-warm p-4 space-y-3 max-h-52 overflow-y-auto">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-xs rounded-2xl px-4 py-2.5 text-xs leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-background/60 border border-border text-foreground rounded-tl-sm"
                      )}
                    >
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
