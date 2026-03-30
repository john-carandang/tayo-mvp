import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile, type TayoProfile } from "@/hooks/use-tayo-state";
import { Mic, MicOff, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceState = "IDLE" | "AI_SPEAKING" | "USER_PROMPT" | "USER_RECORDING" | "PROCESSING" | "ERROR";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PHASE_PROMPTS = [
  "Welcome to Tayo — I'm here to help you understand yourself more deeply and chart a meaningful path forward. To start, could you tell me your name and share one word you'd use to describe where you are in life right now?",
  "Thank you. Tell me about the arc of the last few years — what chapters have you moved through? What changed, what surprised you, and where do you find yourself today?",
  "Now I'd like to understand how you're doing across different areas of your life — your work, your relationships, your physical wellbeing, your emotional state, and your finances. Walk me through each one: what's thriving, what's a struggle, and what matters most to you right now?",
  "When you think about what you value most deeply — the principles that guide your best decisions and give your life real meaning — what comes to mind? What would you refuse to compromise on?",
  "Here's the deeper question: what do you sense you're here to do? What kind of impact do you want to have, and what legacy do you want to leave behind?",
  "You've shared something genuinely meaningful. Is there anything else — something you haven't said yet — that feels important for me to understand as I build your profile?"
];

const PHASE_LABELS = [
  "Introduction",
  "Your Story",
  "Life Areas",
  "Your Values",
  "Your Purpose",
  "Final Thoughts"
];

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function speakText(text: string): Promise<HTMLAudioElement> {
  const res = await fetch(`${BASE_URL}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return audio;
}

async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  const res = await fetch(`${BASE_URL}/api/transcribe`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Transcription failed");
  const data = await res.json();
  return data.text || "";
}

async function chatWithAI(messages: Message[], systemPrompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt }),
  });
  if (!res.ok) throw new Error("Chat failed");
  const data = await res.json();
  return data.response || "";
}

async function extractProfile(conversationText: string, firstName: string): Promise<TayoProfile> {
  const res = await fetch(`${BASE_URL}/api/extract-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationText, firstName }),
  });
  if (!res.ok) throw new Error("Profile extraction failed");
  const data = await res.json();
  return data.profile;
}

const SYSTEM_PROMPT = `You are Tayo, a warm, perceptive life coach conducting an intake conversation. 
Your goal across 6 phases is to deeply understand the user's current life situation, key life events, values, and sense of purpose.
- Be genuinely curious and empathetic
- Ask thoughtful follow-up questions to draw out specific details
- Keep responses conversational and warm — 2-4 sentences
- After phase 6, you will have enough context to build a rich life profile
- Do not number your responses or label phases`;

export default function Intake() {
  const [, setLocation] = useLocation();
  const { setProfile, isHydrated } = useTayoProfile();

  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const [phase, setPhase] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [aiText, setAiText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const playAI = useCallback(async (text: string) => {
    stopAudio();
    setAiText(text);
    setVoiceState("AI_SPEAKING");
    try {
      const audio = await speakText(text);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => {
        setVoiceState("USER_PROMPT");
      };
    } catch {
      setVoiceState("USER_PROMPT");
    }
  }, []);

  const startConversation = useCallback(async () => {
    setHasStarted(true);
    setVoiceState("PROCESSING");
    try {
      await playAI(PHASE_PROMPTS[0]);
      setPhase(0);
    } catch {
      setVoiceState("ERROR");
      setErrorMsg("Failed to start. Please try again.");
    }
  }, [playAI]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceState("PROCESSING");
        try {
          const text = await transcribeAudio(blob);
          setCurrentTranscript(text);

          const userMsg: Message = { role: "user", content: text };
          const updatedMessages = [...messages, userMsg];
          setMessages(updatedMessages);
          setTranscript(prev => [...prev, text]);

          const nextPhase = phase + 1;

          if (nextPhase >= PHASE_PROMPTS.length) {
            // All phases done — ask Claude for final response, then extract profile
            const aiResponse = await chatWithAI(updatedMessages, SYSTEM_PROMPT);
            const finalMessages = [...updatedMessages, { role: "assistant" as const, content: aiResponse }];
            setMessages(finalMessages);
            await playAI(aiResponse);
            setIsComplete(true);
            return;
          }

          // Use Claude to craft a contextual response + transition to next phase prompt
          const transitionPrompt = `${SYSTEM_PROMPT}

You've completed phase ${phase + 1} of 6. 
Respond warmly to what the user just said (1-2 sentences), then transition naturally into asking: "${PHASE_PROMPTS[nextPhase]}"
Make the transition feel organic — don't say "now let's move to phase X" or similar.`;

          const aiResponse = await chatWithAI(updatedMessages, transitionPrompt);
          const assistantMsg: Message = { role: "assistant", content: aiResponse };
          setMessages(prev => [...prev, assistantMsg]);
          setPhase(nextPhase);
          await playAI(aiResponse);
        } catch (err) {
          console.error("Processing error:", err);
          setVoiceState("ERROR");
          setErrorMsg("Something went wrong. Click to retry.");
        }
      };

      recorder.start();
      setVoiceState("USER_RECORDING");
      setCurrentTranscript("");
    } catch {
      setVoiceState("ERROR");
      setErrorMsg("Microphone access denied. Please allow microphone access and refresh.");
    }
  }, [messages, phase, playAI]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleOrbClick = useCallback(() => {
    if (voiceState === "IDLE" && !hasStarted) {
      startConversation();
    } else if (voiceState === "USER_PROMPT") {
      startRecording();
    } else if (voiceState === "USER_RECORDING") {
      stopRecording();
    } else if (voiceState === "ERROR") {
      setVoiceState("USER_PROMPT");
      setErrorMsg("");
    } else if (voiceState === "AI_SPEAKING") {
      stopAudio();
      setVoiceState("USER_PROMPT");
    }
  }, [voiceState, hasStarted, startConversation, startRecording, stopRecording]);

  const handleExtractAndContinue = useCallback(async () => {
    setIsExtracting(true);
    try {
      const conversationText = messages
        .map(m => `${m.role === "user" ? "User" : "Tayo"}: ${m.content}`)
        .join("\n\n");

      const firstNameGuess = transcript[0]?.split(/[\s,!.]+/)[0] || "Friend";
      const profile = await extractProfile(conversationText, firstNameGuess);
      setProfile(profile);
      setLocation("/dashboard");
    } catch (err) {
      console.error("Profile extraction failed:", err);
      setErrorMsg("Failed to build your profile. Please try again.");
      setIsExtracting(false);
    }
  }, [messages, transcript, setProfile, setLocation]);

  const orbState: OrbState =
    voiceState === "AI_SPEAKING" ? "speaking" :
    voiceState === "USER_RECORDING" ? "listening" :
    voiceState === "PROCESSING" ? "processing" : "idle";

  const orbLabel =
    !hasStarted ? "Tap to begin" :
    voiceState === "IDLE" ? "Tap to begin" :
    voiceState === "AI_SPEAKING" ? "Tap to skip" :
    voiceState === "USER_PROMPT" ? "Tap to speak" :
    voiceState === "USER_RECORDING" ? "Tap to finish" :
    voiceState === "PROCESSING" ? "Processing..." :
    voiceState === "ERROR" ? "Tap to retry" : "";

  return (
    <StepLayout step={1} title="Your Voice Intake" subtitle="A guided conversation to understand where you are in life.">
      <div className="flex flex-col items-center gap-8 pt-8">

        {/* Phase indicator */}
        {hasStarted && !isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            {PHASE_PROMPTS.map((_, i) => (
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
              {PHASE_LABELS[Math.min(phase, PHASE_PROMPTS.length - 1)]}
            </span>
          </motion.div>
        )}

        {/* Voice Orb */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <VoiceOrb
            state={orbState}
            size={160}
            onClick={!isComplete ? handleOrbClick : undefined}
            label={!isComplete ? orbLabel : undefined}
            disabled={isComplete}
          />
        </motion.div>

        {/* Current AI text */}
        <AnimatePresence mode="wait">
          {aiText && !isComplete && (
            <motion.div
              key={aiText}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-lg text-center px-4"
            >
              <p className="text-base leading-relaxed text-foreground/80 font-medium italic">
                "{aiText}"
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {voiceState === "ERROR" && errorMsg && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-destructive text-center max-w-sm px-4"
          >
            {errorMsg}
          </motion.p>
        )}

        {/* Transcript log */}
        {transcript.length > 0 && !isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-lg"
          >
            <div className="card-warm p-4 space-y-2 max-h-32 overflow-y-auto">
              {transcript.map((t, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground/60">You:</span> {t}
                </p>
              ))}
            </div>
          </motion.div>
        )}

        {/* Completion screen */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6 max-w-md text-center px-4"
          >
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-display text-foreground">
              Conversation complete
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Thank you for sharing so openly. I have everything I need to build your profile and dashboard.
            </p>
            <button
              onClick={handleExtractAndContinue}
              disabled={isExtracting}
              className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold text-base hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 shadow-lg"
            >
              {isExtracting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Building your profile…
                </>
              ) : (
                <>
                  View Your Dashboard
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Intro text when not started */}
        {!hasStarted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-md text-center px-4 space-y-3"
          >
            <p className="text-muted-foreground leading-relaxed">
              Tayo will guide you through a 6-phase voice conversation — covering your story, life areas, values, and purpose.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Speak naturally. This takes about 10–15 minutes.
            </p>
          </motion.div>
        )}

      </div>
    </StepLayout>
  );
}
