import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile, type TayoProfile } from "@/hooks/use-tayo-state";
import { cn } from "@/lib/utils";

type VoiceState = "IDLE" | "AI_SPEAKING" | "USER_PROMPT" | "USER_RECORDING" | "PROCESSING" | "ERROR";

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

const PHASE_LABELS = [
  "Introduction",
  "Your Story",
  "Life Areas",
  "Values",
  "Purpose",
  "Final Thoughts"
];

const SYSTEM_PROMPT = `You are Tayo, a warm, perceptive life coach conducting a voice intake conversation.
Your goal across 6 phases is to deeply understand the user's current life situation, key life events, values, and sense of purpose.
- Be genuinely curious and empathetic
- Ask thoughtful follow-up questions to draw out specific details
- Keep responses conversational and warm — 2-4 sentences max
- Do not number your responses or label phases`;

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

  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const [phase, setPhase] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [aiText, setAiText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const transcriptRef = useRef<string[]>([]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const playAI = useCallback(async (text: string): Promise<void> => {
    stopAudio();
    setAiText(text);
    setVoiceState("AI_SPEAKING");
    return new Promise((resolve) => {
      speakText(text)
        .then((audio) => {
          audioRef.current = audio;
          audio.play();
          audio.onended = () => {
            setVoiceState("USER_PROMPT");
            resolve();
          };
          audio.onerror = () => {
            setVoiceState("USER_PROMPT");
            resolve();
          };
        })
        .catch(() => {
          setVoiceState("USER_PROMPT");
          resolve();
        });
    });
  }, []);

  const doExtractProfile = useCallback(async (finalMessages: Message[], finalTranscript: string[]) => {
    setIsExtracting(true);
    setVoiceState("PROCESSING");
    try {
      const conversationText = finalMessages
        .map(m => `${m.role === "user" ? "User" : "Tayo"}: ${m.content}`)
        .join("\n\n");

      const firstWord = (finalTranscript[0] ?? "").split(/[\s,!.]+/)[0].replace(/[^a-zA-Z]/g, "");
      const firstName = firstWord || "Friend";

      const profile = await extractProfile(conversationText, firstName);
      setProfile(profile);
      setLocation("/dashboard");
    } catch (err) {
      console.error("Profile extraction failed:", err);
      setIsExtracting(false);
      setVoiceState("ERROR");
      setErrorMsg("Failed to build your profile. Please tap to try again.");
    }
  }, [setProfile, setLocation]);

  const startConversation = useCallback(async () => {
    setHasStarted(true);
    setVoiceState("PROCESSING");
    try {
      // Generate the opening greeting via Claude
      const openingPrompt = `You are Tayo, a warm life coach. Introduce yourself briefly (1 sentence) and then ask: "${PHASE_QUESTIONS[0]}" Keep it natural and welcoming.`;
      const greeting = await chatWithAI(
        [{ role: "user", content: "Hello, I'm ready to begin my intake." }],
        openingPrompt
      );
      const assistantMsg: Message = { role: "assistant", content: greeting };
      const newMessages = [assistantMsg];
      setMessages(newMessages);
      messagesRef.current = newMessages;
      await playAI(greeting);
    } catch {
      setVoiceState("ERROR");
      setErrorMsg("Failed to start. Please tap to retry.");
    }
  }, [playAI]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
          if (!text.trim()) { setVoiceState("USER_PROMPT"); return; }

          const userMsg: Message = { role: "user", content: text };
          const currentMessages = messagesRef.current;
          const updatedMessages = [...currentMessages, userMsg];
          messagesRef.current = updatedMessages;
          setMessages(updatedMessages);

          const currentTranscript = [...transcriptRef.current, text];
          transcriptRef.current = currentTranscript;
          setTranscript(currentTranscript);

          const nextPhase = phase + 1;

          if (nextPhase >= PHASE_QUESTIONS.length) {
            // Phase 6 complete — let Claude close the conversation, then auto-extract
            const closingSystemPrompt = `${SYSTEM_PROMPT}

This is the final phase. Respond warmly to what the user just said (1-2 sentences) and close the conversation gracefully, letting them know their profile is being built.`;

            const aiResponse = await chatWithAI(updatedMessages, closingSystemPrompt);
            const closingMsg: Message = { role: "assistant", content: aiResponse };
            const finalMessages = [...updatedMessages, closingMsg];
            messagesRef.current = finalMessages;
            setMessages(finalMessages);

            // Play the closing response, then immediately auto-extract
            await playAI(aiResponse);
            await doExtractProfile(finalMessages, currentTranscript);
            return;
          }

          // Intermediate phase — Claude responds and transitions to next question
          const transitionPrompt = `${SYSTEM_PROMPT}

You've just heard the user's response to phase ${phase + 1} of 6.
Respond warmly to what they said (1-2 sentences), then organically transition to asking: "${PHASE_QUESTIONS[nextPhase]}"
Do NOT say "phase" or mention any numbering. Keep it conversational.`;

          const aiResponse = await chatWithAI(updatedMessages, transitionPrompt);
          const assistantMsg: Message = { role: "assistant", content: aiResponse };
          const newMessages = [...updatedMessages, assistantMsg];
          messagesRef.current = newMessages;
          setMessages(newMessages);
          setPhase(nextPhase);
          await playAI(aiResponse);
        } catch (err) {
          console.error("Processing error:", err);
          setVoiceState("ERROR");
          setErrorMsg("Something went wrong. Tap to retry.");
        }
      };

      recorder.start();
      setVoiceState("USER_RECORDING");
    } catch {
      setVoiceState("ERROR");
      setErrorMsg("Microphone access denied. Please allow microphone access.");
    }
  }, [phase, playAI, doExtractProfile]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleOrbClick = useCallback(() => {
    if (isExtracting) return;
    if (!hasStarted && voiceState === "IDLE") {
      startConversation();
    } else if (voiceState === "USER_PROMPT") {
      startRecording();
    } else if (voiceState === "USER_RECORDING") {
      stopRecording();
    } else if (voiceState === "AI_SPEAKING") {
      stopAudio();
      setVoiceState("USER_PROMPT");
    } else if (voiceState === "ERROR") {
      setVoiceState(hasStarted ? "USER_PROMPT" : "IDLE");
      setErrorMsg("");
    }
  }, [voiceState, hasStarted, isExtracting, startConversation, startRecording, stopRecording]);

  const orbState: OrbState =
    isExtracting ? "processing" :
    voiceState === "AI_SPEAKING" ? "speaking" :
    voiceState === "USER_RECORDING" ? "listening" :
    voiceState === "PROCESSING" ? "processing" : "idle";

  const orbLabel =
    isExtracting ? "Building your profile…" :
    !hasStarted ? "Tap to begin" :
    voiceState === "AI_SPEAKING" ? "Tap to skip" :
    voiceState === "USER_PROMPT" ? "Tap to speak" :
    voiceState === "USER_RECORDING" ? "Tap when done" :
    voiceState === "PROCESSING" ? "Processing…" :
    voiceState === "ERROR" ? "Tap to retry" : "";

  return (
    <StepLayout step={1} title="Your Voice Intake" subtitle="A guided conversation to understand where you are in life.">
      <div className="flex flex-col items-center gap-8 pt-8">

        {/* Phase progress */}
        {hasStarted && !isExtracting && (
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
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <VoiceOrb
            state={orbState}
            size={160}
            onClick={handleOrbClick}
            label={orbLabel}
            disabled={isExtracting || voiceState === "PROCESSING"}
          />
        </motion.div>

        {/* Current AI speech text */}
        <AnimatePresence mode="wait">
          {aiText && hasStarted && !isExtracting && (
            <motion.div
              key={aiText}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-lg text-center px-4"
            >
              <p className="text-base leading-relaxed text-foreground/75 italic">
                "{aiText}"
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Extracting overlay message */}
        {isExtracting && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 text-center px-4"
          >
            <p className="text-base font-medium text-foreground">Building your profile…</p>
            <p className="text-sm text-muted-foreground">Analysing your conversation and preparing your dashboard.</p>
          </motion.div>
        )}

        {/* Error */}
        {voiceState === "ERROR" && errorMsg && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive text-center max-w-sm px-4">
            {errorMsg}
          </motion.p>
        )}

        {/* Recent transcript snippets */}
        {transcript.length > 0 && !isExtracting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-lg">
            <div className="card-warm p-4 space-y-2 max-h-28 overflow-y-auto">
              {transcript.slice(-3).map((t, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground/50">You: </span>{t}
                </p>
              ))}
            </div>
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
            <p className="text-xs text-muted-foreground/60">Speak naturally. This takes about 10–15 minutes.</p>
          </motion.div>
        )}

      </div>
    </StepLayout>
  );
}
