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

const SESSION_DURATION_MS = 28 * 60 * 1000;

type VoiceState = "LOADING" | "AI_SPEAKING" | "USER_PROMPT" | "USER_RECORDING" | "PROCESSING" | "ERROR" | "EXTRACTING";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const COACHING_RULES = `COACHING BEHAVIOR RULES:
1. QUESTION DISCIPLINE: Ask exactly one question per turn. Never stack questions.
2. TURN LENGTH: Keep responses short and warm — 2-3 sentences max. Restate what you heard, then ask your next question.
3. NO ASSUMPTIONS: Do not assume anything about the user's circumstances unless they've stated it.
4. FOLLOW THE USER: When the user redirects, follow them. Ask "Oh interesting — why?" gently.
5. PRECISION PLAYBACK: Reflect back what you hear — including patterns and contradictions the user may not have noticed.
6. NON-SYCOPHANTIC: Never just agree. Probe gently when something deserves more examination.
7. STRENGTH-BASED: Frame challenges as design problems — natural friction from their values and circumstances.
8. CLINICAL BOUNDARY: If the user shows signs of clinical concern, acknowledge warmly and refer to professional support.
9. CULTURAL TOUCHPOINTS: Weave in light questions about music, shows, podcasts, books — natural trust-builders.
10. NO CHART REFERENCES: Never reference a chart, graph, dashboard, or visual tool. The user cannot see visuals.
11. FORMAT: Never use markdown formatting. Plain prose only — no asterisks, hashtags, bullets, or numbered lists.
12. CLOSING: When wrapping up, ask: "Based on everything we've talked about today, what are 1 or 2 things you feel ready to commit to before we speak again?" Then confirm exactly what they committed to and close warmly.`;

function buildSession1Prompt(warmupData: Record<string, unknown> | null): string {
  const warmupContext = warmupData ? `
Warm-up context (weave naturally — do not read as a checklist):
- Music they're into: ${warmupData.music || "not shared"}
- YouTube they watch: ${warmupData.youtube || "not shared"}
- Media on their mind: ${warmupData.media || "not shared"}
- Photos representing them: ${warmupData.photos ? (warmupData.photos as string[]).join(", ") : "not shared"}
` : "";

  return `You are Tayo, a warm and perceptive life coach conducting a voice intake conversation. This is Session 1.

Your goal is inquiry and relationship-building — go deep on whatever the user brings. Build trust first.
${warmupContext}

Your very first message: Welcome the user warmly to Tayo. Tell them this is a space to think out loud about their life — their story, what matters, what they're navigating. Tell them to plan for 25–28 minutes and the more openly they share, the richer their insights. Then ask: "What's top of mind for you today?"

Over the course of this conversation, gently explore (in whatever order feels natural):
- Their life story and key chapters — highs, lows, turning points
- How different areas of their life are going: work, relationships, health, emotional wellbeing, finances
- What they value most and what gives them meaning
- What they sense they're here to do or become

${COACHING_RULES}

ICF FRAMEWORK: Grounded in ICF Core Competencies (2025). The client is naturally creative, resourceful, and whole.`;
}

function buildSession2PlusPrompt(sessionNumber: number, lastProfile: TayoProfile | null): string {
  const bridgeContext = lastProfile ? `
Last session themes to reference (choose ONE as a warm bridge into today):
- Key values: ${lastProfile.values?.slice(0, 3).join(", ") || "not yet captured"}
- Purpose themes: ${lastProfile.purposeThemes?.slice(0, 2).join(", ") || "not yet captured"}
- Overall narrative: ${lastProfile.overallNarrative?.slice(0, 200) || ""}
` : "";

  return `You are Tayo, a warm and perceptive life coach conducting Session ${sessionNumber} with a returning client.
${bridgeContext}

Your opening: Reference one key theme or commitment from the last session as a warm bridge (1 sentence). Then ask: "What's top of mind for you today?" Do NOT recap the last session at length.

Over the course of this conversation, go deep on whatever the user brings today. Build on what was established in previous sessions.

${COACHING_RULES}

ICF FRAMEWORK: Grounded in ICF Core Competencies (2025). The client is naturally creative, resourceful, and whole.`;
}

function buildGracefulClosePrompt(basePrompt: string): string {
  return `${basePrompt}

IMPORTANT — GRACEFUL CLOSE: We are at 28 minutes. Wrap up the current thread warmly (1 sentence), then say exactly: "We're coming up on our time together — before we wrap up, I want to make sure we leave you with something to work with. Based on everything we've talked about today, what are 1 or 2 things you feel ready to commit to before we speak again? They could be daily habits, one-off things to try, or just something to reflect on."`;
}

function buildCommitmentConfirmPrompt(basePrompt: string): string {
  return `${basePrompt}

IMPORTANT — CONFIRM COMMITMENTS: The user has just shared their commitments. In your response:
1. Confirm exactly what they committed to in plain language: "So you're committing to [X]..." (be specific, use their words)
2. Say: "I'll add those to your Next Moves."
3. Close warmly: "Your dashboard is being updated with your story, who you are now, and where you're heading. These are very much a work in progress — they'll evolve and deepen as we continue our sessions together. I'll see you in a week."
Do NOT ask any more questions. This is the final turn.`;
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

async function parseCommitmentsToAssignments(commitmentText: string, token: string): Promise<void> {
  if (!commitmentText.trim()) return;
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: "Parse the user's stated commitments into assignment objects. Return ONLY valid JSON array. No markdown.",
        messages: [{
          role: "user",
          content: `Parse these commitments into assignments. Return JSON array:
[{"title": "short title", "description": "what they committed to", "type": "daily_habit"|"one_off_task"|"reflection"}]

Commitments: "${commitmentText}"

Rules: 1-3 assignments max. Keep titles concise. Match type to commitment (habits → daily_habit, tasks → one_off_task, reflection prompts → reflection).`,
        }],
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const raw = (data.response as string) || "[]";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    let assignments: Array<{ title: string; description: string; type: string }> = [];
    try { assignments = JSON.parse(cleaned); } catch { return; }
    if (assignments.length === 0) return;
    await fetch(`${BASE_URL}/api/assignments/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ assignments }),
    });
  } catch { /* non-fatal */ }
}

export default function Intake() {
  const [, setLocation] = useLocation();
  const { setProfile } = useTayoProfile();
  const { getToken, getTokenAsync } = useAuth();

  const [voiceState, setVoiceState] = useState<VoiceState>("LOADING");
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [extractError, setExtractError] = useState(false);
  const [extractStatus, setExtractStatus] = useState("Building your profile…");

  // Session meta
  const [sessionNumber, setSessionNumber] = useState(1);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Close flow
  const gracefulCloseTriggeredRef = useRef(false);
  const turnsAfterCloseRef = useRef(0);
  const commitmentTextRef = useRef("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackCancelRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const systemPromptRef = useRef("");

  const coachVoiceId = localStorage.getItem("tayo_coach_voice_id") || undefined;

  // Load session number + build system prompt
  useEffect(() => {
    const initialize = async () => {
      try {
        const tok = await getTokenAsync();
        const warmupRaw = localStorage.getItem("tayo_warmup");
        const warmupData = warmupRaw ? JSON.parse(warmupRaw) : null;

        if (!tok) {
          systemPromptRef.current = buildSession1Prompt(warmupData);
          setSessionNumber(1);
          setSessionLoaded(true);
          return;
        }

        const [sessionsRes, lastSessionRes] = await Promise.all([
          fetch(`${BASE_URL}/api/sessions`, { headers: { Authorization: `Bearer ${tok}` } }),
          fetch(`${BASE_URL}/api/sessions/latest`, { headers: { Authorization: `Bearer ${tok}` } }),
        ]);

        let sesCount = 0;
        let lastProfile: TayoProfile | null = null;

        if (sessionsRes.ok) {
          const d = await sessionsRes.json();
          sesCount = (d.sessions ?? []).length;
        }
        if (lastSessionRes.ok) {
          const d = await lastSessionRes.json();
          if (d.session?.profile_json) lastProfile = d.session.profile_json as TayoProfile;
        }

        const nextNum = sesCount + 1;
        setSessionNumber(nextNum);

        if (sesCount === 0) {
          systemPromptRef.current = buildSession1Prompt(warmupData);
        } else {
          systemPromptRef.current = buildSession2PlusPrompt(nextNum, lastProfile);
        }
      } catch {
        const warmupRaw = localStorage.getItem("tayo_warmup");
        const warmupData = warmupRaw ? JSON.parse(warmupRaw) : null;
        systemPromptRef.current = buildSession1Prompt(warmupData);
        setSessionNumber(1);
      }
      setSessionLoaded(true);
    };
    initialize();
  }, [getTokenAsync]);

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

  // Greeting — trigger once session is loaded
  useEffect(() => {
    if (!sessionLoaded) return;
    let cancelled = false;
    const greet = async () => {
      try {
        const greeting = await chatWithAI(
          [{ role: "user", content: "Hello, I'm ready to begin." }],
          systemPromptRef.current
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
  }, [sessionLoaded, playAI]);

  // 28-minute graceful close timer
  useEffect(() => {
    if (!sessionLoaded) return;
    const timer = setTimeout(() => {
      gracefulCloseTriggeredRef.current = true;
    }, SESSION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [sessionLoaded]);

  const doExtractProfile = useCallback(async (userCommitmentText?: string) => {
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

      const token = await getTokenAsync();
      if (token) {
        try {
          // Parse and save commitments
          const commitmentText = userCommitmentText || commitmentTextRef.current;
          await parseCommitmentsToAssignments(commitmentText, token);

          // Save session (sets last_session_ended_at)
          await fetch(`${BASE_URL}/api/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ transcript: conversationText, profile_json: profile }),
          });

          // Generate dashboard snapshot
          await fetch(`${BASE_URL}/api/dashboard-snapshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ profile_json: profile }),
          });
        } catch { /* non-fatal */ }
      }

      setLocation("/dashboard");
    } catch {
      setVoiceState("USER_PROMPT");
      setExtractError(true);
    }
  }, [setProfile, setLocation, getTokenAsync]);

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

          // Graceful close flow
          if (gracefulCloseTriggeredRef.current) {
            const turn = turnsAfterCloseRef.current;

            if (turn === 0) {
              // User's commitment response — store it
              commitmentTextRef.current = text;
              turnsAfterCloseRef.current = 1;

              // AI confirms commitments and closes
              const confirmPrompt = buildCommitmentConfirmPrompt(systemPromptRef.current);
              const aiResponse = await chatWithAI(updatedMessages, confirmPrompt);
              addMessage({ role: "assistant", content: aiResponse });
              await playAI(aiResponse);

              // Trigger extraction after close speech
              await doExtractProfile(text);
              return;
            }
          }

          // Check if close should trigger NOW (this response prompts for commitments)
          if (gracefulCloseTriggeredRef.current && turnsAfterCloseRef.current === 0) {
            // This branch handles the case where grace was triggered between turns
            const closePrompt = buildGracefulClosePrompt(systemPromptRef.current);
            const aiResponse = await chatWithAI(updatedMessages, closePrompt);
            addMessage({ role: "assistant", content: aiResponse });
            await playAI(aiResponse);
            // Don't increment yet — next user turn is the commitment
            return;
          }

          // Normal conversation turn
          let promptToUse = systemPromptRef.current;

          // If graceful close was triggered, this is the first AI response after the trigger
          if (gracefulCloseTriggeredRef.current && turnsAfterCloseRef.current === 0) {
            promptToUse = buildGracefulClosePrompt(systemPromptRef.current);
          }

          const aiResponse = await chatWithAI(updatedMessages, promptToUse);
          addMessage({ role: "assistant", content: aiResponse });
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

  // When AI finishes the graceful close prompt, user turn starts — we show commitment prompt
  useEffect(() => {
    if (voiceState === "USER_PROMPT" && gracefulCloseTriggeredRef.current && turnsAfterCloseRef.current === 0) {
      // AI has prompted for commitments, waiting for user response
    }
  }, [voiceState]);

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
    voiceState === "PROCESSING" ? "Thinking…" :
    voiceState === "ERROR" ? "Tap to retry" : "";

  const hasEnoughForExtraction = messagesRef.current.filter(m => m.role === "user").length >= 3;
  const isSessionN = sessionNumber > 1;

  const sessionDescription = isSessionN
    ? `Session ${sessionNumber}. Find a quiet space and give yourself 25–30 minutes.`
    : "Speak openly — your story, what matters, what you're navigating. Plan for about 25–30 minutes.";

  return (
    <StepLayout
      title={isSessionN ? `Session ${sessionNumber}` : "Your Voice Intake"}
      description={sessionDescription}
    >
      <div className="flex flex-col items-center gap-6 pt-6">
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

        {/* Graceful close hint */}
        {voiceState === "USER_PROMPT" && gracefulCloseTriggeredRef.current && turnsAfterCloseRef.current === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center px-4 py-3 rounded-xl max-w-sm"
            style={{ backgroundColor: "rgba(196,98,45,0.08)", border: "1px solid rgba(196,98,45,0.15)" }}
          >
            <p className="text-xs" style={{ color: "#C4622D" }}>
              Share your 1–2 commitments, then tap "done" when finished.
            </p>
          </motion.div>
        )}

        {voiceState === "EXTRACTING" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
            <p className="text-base font-medium" style={{ color: "#2C1810" }}>{extractStatus}</p>
            <p className="text-sm" style={{ color: "#9B8E84" }}>Your dashboard will be ready in a moment.</p>
          </motion.div>
        )}

        {extractError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <p className="text-sm" style={{ color: "#C4622D" }}>Failed to build profile. Try again.</p>
            <button
              onClick={() => doExtractProfile()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </motion.div>
        )}

        {voiceState === "ERROR" && errorMsg && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-center max-w-sm px-4" style={{ color: "#C4622D" }}>
            {errorMsg}
          </motion.p>
        )}

        {/* Wrap up early */}
        {hasEnoughForExtraction && voiceState === "USER_PROMPT" && !gracefulCloseTriggeredRef.current && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              onClick={() => {
                gracefulCloseTriggeredRef.current = true;
              }}
              className="text-xs underline"
              style={{ color: "#9B8E84" }}
            >
              Wrap up the session
            </button>
          </motion.div>
        )}

        {/* Transcript */}
        <AnimatePresence>
          {messages.length > 0 && voiceState !== "EXTRACTING" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
              <div
                className="p-4 space-y-3 max-h-52 overflow-y-auto rounded-2xl"
                style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}
              >
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className="max-w-xs rounded-2xl px-4 py-2.5 text-xs leading-relaxed"
                      style={msg.role === "user"
                        ? { backgroundColor: "#C4622D", color: "#F5F0E8", borderRadius: "16px 16px 4px 16px" }
                        : { backgroundColor: "rgba(44,24,16,0.05)", border: "1px solid rgba(44,24,16,0.08)", color: "#2C1810", borderRadius: "16px 16px 16px 4px" }
                      }
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
