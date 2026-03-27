import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Send, ArrowRight, Loader2, Bot } from "lucide-react";
import { StepLayout } from "@/components/layout/StepLayout";
import { useTayoState } from "@/hooks/use-tayo-state";
import { useChat, useGeneratePlan } from "@workspace/api-client-react";
import type { ChatMessage } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export default function Chat() {
  const [, setLocation] = useLocation();
  const { state, updateState, isHydrated } = useTayoState();
  const [input, setInput] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const { mutateAsync: sendMessage, isPending: isSending } = useChat();
  const { mutateAsync: generatePlan, isPending: isGeneratingPlan } = useGeneratePlan();

  useEffect(() => {
    if (isHydrated && !state.firstName) {
      setLocation("/");
    }
  }, [isHydrated, state.firstName, setLocation]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.chatHistory]);

  const generateSystemPrompt = () => {
    const dimText = state.dimensions.map(d => 
      `- ${d.name}: Thriving ${d.thriving}/10, Importance ${d.importance}/10. (Gap: ${d.importance - d.thriving}). User context: "${d.openText}"`
    ).join("\n");

    return `You are Tayo, a warm, analytically precise life coach. The user's name is ${state.firstName}. 
Their dimension scores are:
${dimText}

Your objective: 
1. Help the user make sense of their whole-person dashboard by exploring what their scores, gaps, and open-text responses reveal.
2. Help them surface and articulate what they genuinely value and their authentic purpose.
3. Lay the groundwork for a personal strategic plan.

Be direct, insightful, and specific. Reference their actual data. Do not be generic. Keep responses concise and conversational (1-2 short paragraphs). End with a thought-provoking question.`;
  };

  // Initialize chat with a greeting if empty
  useEffect(() => {
    if (isHydrated && state.chatHistory.length === 0) {
      const initGreeting = async () => {
        const sysPrompt = generateSystemPrompt();
        try {
          const res = await sendMessage({
            data: {
              messages: [{ role: "user", content: "Hello, I'm ready to discuss my dashboard." }],
              systemPrompt: sysPrompt
            }
          });
          updateState({
            chatHistory: [{ role: "assistant", content: res.message }]
          });
        } catch (e) {
          console.error("Failed to init chat", e);
          updateState({
            chatHistory: [{ role: "assistant", content: `Welcome ${state.firstName}. I've reviewed your dashboard. Let's explore what's standing out to you first.` }]
          });
        }
      };
      initGreeting();
    }
  }, [isHydrated, state.chatHistory.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    const newHistory = [...state.chatHistory, userMsg];
    
    updateState({ chatHistory: newHistory });
    setInput("");

    try {
      const res = await sendMessage({
        data: {
          messages: newHistory,
          systemPrompt: generateSystemPrompt()
        }
      });
      updateState({
        chatHistory: [...newHistory, { role: "assistant", content: res.message }]
      });
    } catch (error) {
      console.error("Failed to send message", error);
      updateState({
        chatHistory: [...newHistory, { role: "assistant", content: "I'm having trouble connecting right now. Could you repeat that?" }]
      });
    }
  };

  const handleGeneratePlan = async () => {
    try {
      const res = await generatePlan({
        data: {
          conversationHistory: state.chatHistory,
          dimensions: state.dimensions,
          firstName: state.firstName
        }
      });
      updateState({ plan: res.plan });
      setLocation("/plan");
    } catch (error) {
      console.error("Failed to generate plan", error);
    }
  };

  if (!isHydrated) return null;

  return (
    <StepLayout step={3} title="Coaching Session">
      <div className="w-full max-w-3xl mx-auto flex flex-col h-[70vh] bg-card rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-white/5 bg-background/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Tayo AI</h3>
              <p className="text-xs text-primary flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Online
              </p>
            </div>
          </div>
          <button
            onClick={handleGeneratePlan}
            disabled={isGeneratingPlan || state.chatHistory.length < 2}
            className="text-xs sm:text-sm px-4 py-2 bg-primary text-black font-bold rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
          >
            {isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : "Build My Plan"} 
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {state.chatHistory.map((msg, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i}
              className={cn(
                "flex w-full",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-5 py-4 text-sm sm:text-base leading-relaxed",
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-tr-sm" 
                    : "bg-white/5 border border-white/5 text-foreground rounded-tl-sm"
                )}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
          {isSending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4 flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </motion.div>
          )}
          <div ref={endOfMessagesRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background/80 backdrop-blur-xl border-t border-white/5">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Reflect on your results..."
              className="w-full bg-white/5 border border-white/10 rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-primary transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="absolute right-2 w-10 h-10 rounded-full bg-primary text-black flex items-center justify-center disabled:opacity-50 transition-opacity hover:bg-white"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
        </div>
        
        {/* Generating Plan Overlay */}
        {isGeneratingPlan && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-xl font-display font-bold">Synthesizing Your Insights</h3>
            <p className="text-muted-foreground mt-2">Drafting your personal strategic plan...</p>
          </div>
        )}
      </div>
    </StepLayout>
  );
}
