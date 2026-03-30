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

const NO_MARKDOWN_RULE = `CRITICAL FORMATTING RULE: Never use any Markdown formatting in your responses. This means: no asterisks for bold or italics, no hashtags for headings, no bullet point symbols, no numbered lists with dots, no backticks, no underscores for emphasis. Write entirely in plain prose. Sentences and paragraphs only. This applies to every single message you generate in this conversation without exception.`;

const SYSTEM_PROMPT = `You are Tayo, a warm, perceptive life coach conducting a voice intake conversation.

Your very first message must do the following: Welcome the user warmly to Tayo. Explain that in this session you will explore their life journey together — their story, the key dimensions of their wellbeing, their values, and what matters most to them. Tell them to plan for around 15 to 20 minutes, and that the more openly they share, the richer their insights will be. Encourage them to find a quiet space, speak naturally, and not worry about getting things right — there are no right answers. Then ask them their name and how they would describe where they are in life in just a few words. Keep this opening under 100 words.

By the end of this conversation, you must have gathered enough information to populate ALL of the following — do not close the conversation until each is covered:
(1) JOURNEY TO DATE CHART: a sequence of named life chapters or events, each with a sense of whether it was a high point, low point, transition, or milestone, and the emotional quality of that period.
(2) WHO YOU ARE NOW PYRAMID: each of the five dimensions (Mental and Emotional, Career, Physical, Social and Relationships, Financial and Security) rated on how much they are thriving and how important they feel to the user.
(3) WHERE TO JOURNEY NEXT CHART: how much each dimension is thriving versus how important it feels — both ratings matter.
(4) STRATEGIC PLAN — STORY SECTION: their arc over the last few years, what has shifted, and what this moment represents.
(5) STRATEGIC PLAN — STRENGTHS SECTION: 4 to 6 specific strengths the user has demonstrated or expressed.
(6) STRATEGIC PLAN — PURPOSE SECTION: their core why — what drives them, what impact they want to make, what legacy they want to leave.

Across 6 phases, deeply understand the user's current life situation, key life events, values, and sense of purpose.
- Be genuinely curious and empathetic
- Keep responses conversational and warm — 2-4 sentences max per response
- Do not number responses or mention phase numbers
- Ask one clear question at a time and listen deeply
${NO_MARKDOWN_RULE}`;

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Clean markdown artifacts before speaking or displaying
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
  const [errorMsg, setErrorMsg] = useState("");
  const [extractError, setExtractError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackCancelRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const phaseRef = useRef(0);

  const stopAudio = useCallback(() => {
    playbackCancelRef.current = true;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  // Sentence-by-sentence parallel TTS for faster perceived latency
  const playAI = useCallback(async (text: string): Promise<void> => {
    stopAudio();
    playbackCancelRef.current = false;
    setVoiceState("AI_SPEAKING");

    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) {
      setVoiceState("USER_PROMPT");
      return;
    }

    // Fire all TTS requests in parallel for minimum latency.
    // Attach .catch immediately so a failed promise never becomes an unhandled rejection
    // before the for-loop awaits it.
    const audioPromises = sentences.map(s => speakText(s).catch(() => null));

    // Play each sentence sequentially as they become ready
    for (const promise of audioPromises) {
      if (playbackCancelRef.current) break;
      try {
        const audio = await promise;
        if (!audio) continue; // TTS failed for this sentence — skip silently
        if (playbackCancelRef.current) break;
        audioRef.current = audio;
        await new Promise<void>(resolve => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          const p = audio.play();
          if (p !== undefined) p.catch(() => resolve());
          // Safety timeout
          setTimeout(resolve, 30000);
        });
      } catch {
        // continue on individual sentence error
      }
    }

    if (!playbackCancelRef.current) {
      setVoiceState("USER_PROMPT");
    }
  }, [stopAudio]);

  const addMessage = useCallback((msg: Message) => {
    const updated = [...messagesRef.current, msg];
    messagesRef.current = updated;
    setMessages(updated);
    return updated;
  }, []);

  // Auto-greet on mount with warm orientation as first message
  useEffect(() => {
    let cancelled = false;
    const greet = async () => {
      try {
        const greeting = await chatWithAI(
          [{ role: "user", content: "Hello, I'm ready to begin my Tayo intake session." }],
          SYSTEM_PROMPT
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

          const currentPhase = phaseRef.current;
          const nextPhase = currentPhase + 1;

          if (nextPhase >= PHASE_QUESTIONS.length) {
            const closingPrompt = `${SYSTEM_PROMPT}

This is the final phase of the intake. Respond warmly (1-2 sentences) acknowledging what the user shared, and let them know their profile is now being built. Make it feel like a meaningful moment of completion.`;
            const aiResponse = await chatWithAI(updatedMessages, closingPrompt);
            addMessage({ role: "assistant", content: aiResponse });
            await playAI(aiResponse);
            await doExtractProfile();
            return;
          }

          const transitionPrompt = `${SYSTEM_PROMPT}

Respond warmly to what the user just shared (1-2 sentences acknowledging their specific words), then ask: "${PHASE_QUESTIONS[nextPhase]}"
Do NOT mention phase numbers. Reference something specific they said.`;
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
    voiceState === "PROCESSING" ? "Tayo is thinking…" :
    voiceState === "ERROR" ? "Tap to retry" : "";

  return (
    <StepLayout
      step={1}
      title="Your Voice Intake"
      description="This is your space to reflect honestly on your life — your journey, your dimensions of wellbeing, and what matters most to you. Tayo will guide you through a natural conversation at your own pace. Plan for around 15–20 minutes to get the most out of this session."
    >
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