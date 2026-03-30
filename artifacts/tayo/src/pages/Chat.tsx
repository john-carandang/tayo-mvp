import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { StepLayout } from "@/components/layout/StepLayout";
import { VoiceOrb, type OrbState } from "@/components/ui/VoiceOrb";
import { useTayoProfile, useChatHistory } from "@/hooks/use-tayo-state";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

type VoiceState = "IDLE" | "AI_SPEAKING" | "USER_PROMPT" | "USER_RECORDING" | "PROCESSING" | "ERROR";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const NO_MARKDOWN_RULE = `CRITICAL FORMATTING RULE: Never use any Markdown formatting in your responses. This means: no asterisks for bold or italics, no hashtags for headings, no bullet point symbols, no numbered lists with dots, no backticks, no underscores for emphasis. Write entirely in plain prose. Sentences and paragraphs only. This applies to every single message you generate in this conversation without exception.`;

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

async function speakText(text: string): Promise<HTMLAudioElement> {
  const cleaned = cleanText(text);
  const res = await fetch(`${BASE_URL}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: cleaned }),
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

async function chatWithAI(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt }),
  });
  if (!res.ok) throw new Error("Chat failed");
  const data = await res.json();
  return data.response || "";
}

export default function Chat() {
  const [, setLocation] = useLocation();
  const { profile, isHydrated } = useTayoProfile();
  const { history, setHistory } = useChatHistory();

  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const [currentAiText, setCurrentAiText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackCancelRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHydrated && !profile) setLocation("/");
  }, [isHydrated, profile, setLocation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const buildSystemPrompt = useCallback(() => {
    if (!profile) return "";

    const topDim = [...profile.dimensions].sort((a, b) => b.importance - a.importance)[0];
    const openingQuestion = topDim
      ? `Looking at your ${topDim.name} dimension — what feels most alive or most unresolved for you there right now?`
      : `What from your intake session is sitting with you most strongly right now?`;

    return `You are Tayo, a warm and incisive life coach. The user's name is ${profile.firstName}.

Your very first message must do the following: Welcome ${profile.firstName} back warmly by name. Tell them this session is about going deeper — making sense of what their dashboard revealed, exploring their values and purpose, and preparing for their strategic plan. Tell them to plan for around 10 to 15 minutes. Invite them to speak freely and honestly. Then ask this opening question: "${openingQuestion}". Keep this opening under 80 words.

Full life profile (JSON):
${JSON.stringify(profile, null, 2)}

Your role: Help ${profile.firstName} go deeper on their insights, clarify what they want, and prepare them for their strategic plan. Be direct, specific, and reference their actual dimensions, values, life events, and themes from the profile above. Keep responses concise — 2-4 sentences. End each response with a focused question.

${NO_MARKDOWN_RULE}`;
  }, [profile]);

  const stopAudio = useCallback(() => {
    playbackCancelRef.current = true;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  // Sentence-by-sentence parallel TTS for faster perceived latency
  const playAI = useCallback(async (text: string) => {
    stopAudio();
    playbackCancelRef.current = false;
    setCurrentAiText(text);
    setVoiceState("AI_SPEAKING");

    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) { setVoiceState("USER_PROMPT"); return; }

    // Fire all TTS in parallel, play sequentially.
    // Attach .catch immediately so failed promises never become unhandled rejections.
    const audioPromises = sentences.map(s => speakText(s).catch(() => null));

    for (const promise of audioPromises) {
      if (playbackCancelRef.current) break;
      try {
        const audio = await promise;
        if (!audio) continue; // TTS failed — skip silently
        if (playbackCancelRef.current) break;
        audioRef.current = audio;
        await new Promise<void>(resolve => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          const p = audio.play();
          if (p !== undefined) p.catch(() => resolve());
        });
      } catch {
        // continue
      }
    }

    if (!playbackCancelRef.current) setVoiceState("USER_PROMPT");
  }, [stopAudio]);

  // Auto-start: greet the user when they first arrive
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

          const aiResponse = await chatWithAI(updatedHistory, buildSystemPrompt());
          const assistantMsg = { role: "assistant", content: aiResponse };
          setHistory([...updatedHistory, assistantMsg]);
          await playAI(aiResponse);
        } catch (err) {
          console.error(err);
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
  }, [history, buildSystemPrompt, setHistory, playAI]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      setVoiceState("PROCESSING"); // immediate visual feedback
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleOrbClick = useCallback(() => {
    if (voiceState === "USER_PROMPT") startRecording();
    else if (voiceState === "USER_RECORDING") stopRecording();
    else if (voiceState === "AI_SPEAKING") { stopAudio(); setVoiceState("USER_PROMPT"); }
    else if (voiceState === "ERROR") { setVoiceState("USER_PROMPT"); setErrorMsg(""); }
  }, [voiceState, startRecording, stopRecording, stopAudio]);

  const handleGeneratePlan = useCallback(async () => {
    if (!profile) return;
    setIsGeneratingPlan(true);
    stopAudio();
    try {
      const res = await fetch(`${BASE_URL}/api/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, conversationHistory: history, firstName: profile.firstName }),
      });
      if (!res.ok) throw new Error("Plan generation failed");
      const data = await res.json();
      localStorage.setItem("tayo_plan", data.plan);
      setLocation("/plan");
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [profile, history, setLocation, stopAudio]);

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

  return (
    <StepLayout
      step={3}
      title="Coaching Session"
      description="This is your space to go deeper with Tayo — making sense of your dashboard, exploring your values and purpose, and preparing to articulate your life's direction. Plan for around 10–15 minutes."
    >
      <div className="flex flex-col items-center gap-6">

        {/* Chat history */}
        {history.length > 0 && (
          <div className="w-full max-w-lg space-y-3 max-h-72 overflow-y-auto pr-1">
            {history.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div className={cn(
                  "max-w-xs sm:max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "card-warm text-foreground rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Current AI text while speaking */}
        <AnimatePresence mode="wait">
          {voiceState === "AI_SPEAKING" && currentAiText && (
            <motion.p
              key={currentAiText}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-center text-muted-foreground max-w-sm px-4 italic"
            >
              "{currentAiText}"
            </motion.p>
          )}
        </AnimatePresence>

        {/* Voice Orb */}
        <VoiceOrb
          state={orbStateDisplay}
          size={100}
          onClick={handleOrbClick}
          label={orbLabel}
        />

        {errorMsg && (
          <p className="text-sm text-destructive text-center">{errorMsg}</p>
        )}

        {/* Generate Plan button — available after first user exchange */}
        {history.filter(m => m.role === "user").length >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <button
              onClick={handleGeneratePlan}
              disabled={isGeneratingPlan}
              className="flex items-center gap-2 px-6 py-3 border-2 border-primary text-primary rounded-full font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-50"
            >
              {isGeneratingPlan ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Building your plan…
                </>
              ) : (
                <>
                  Generate My Life Strategic Plan
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </motion.div>
        )}

      </div>
    </StepLayout>
  );
}
