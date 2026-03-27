import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, RotateCcw, Calendar, Target } from "lucide-react";
import { StepLayout } from "@/components/layout/StepLayout";
import { useTayoState } from "@/hooks/use-tayo-state";

export default function Habits() {
  const [, setLocation] = useLocation();
  const { state, resetState, isHydrated } = useTayoState();

  useEffect(() => {
    if (isHydrated && (!state.firstName || !state.habits)) {
      setLocation("/");
    }
  }, [isHydrated, state.firstName, state.habits, setLocation]);

  const handleStartOver = () => {
    resetState();
    setLocation("/");
  };

  if (!isHydrated || !state.habits) return null;

  // Very basic parser for the habits response assuming standard list format
  // We'll split by double newline to get chunks, and try to style them as cards
  const chunks = state.habits.split('\n\n').filter(Boolean);
  
  // Separate an intro paragraph if it exists, treat the rest as cards
  const intro = chunks.length > 0 && !chunks[0].includes(':') && !chunks[0].startsWith('-') ? chunks[0] : null;
  const cardsText = intro ? chunks.slice(1) : chunks;

  return (
    <StepLayout step={5} title="Your Execution System">
      <div className="max-w-4xl mx-auto pb-32">
        
        {intro && (
          <p className="text-center text-muted-foreground text-lg mb-12 max-w-2xl mx-auto">
            {intro}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {cardsText.map((card, idx) => {
            const lines = card.split('\n');
            const titleLine = lines[0].replace(/^[-*#0-9.)]*\s*/, '');
            const body = lines.slice(1).join(' ').replace(/^[-*]\s*/g, '');
            
            // Try to extract frequency or value alignment if formatted predictably
            const isDaily = card.toLowerCase().includes('daily');
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card p-6 rounded-2xl border border-white/5 hover:border-primary/30 transition-colors group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors" />
                
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <h3 className="font-bold text-lg text-white pr-4">{titleLine}</h3>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 relative z-10">
                  {body || "Execute consistently to build momentum."}
                </p>
                
                <div className="flex items-center gap-3 mt-auto relative z-10">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/5 px-2.5 py-1 rounded-md text-white/70">
                    {isDaily ? <Calendar className="w-3 h-3" /> : <Target className="w-3 h-3" />}
                    {isDaily ? "Daily Habit" : "Milestone Goal"}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>

        <div className="flex flex-col items-center justify-center gap-6 border-t border-white/10 pt-12">
          <h2 className="text-2xl font-display">Ready to Begin?</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Your plan is set. Bookmarks this page or save your results to review your progress in 30 days.
          </p>
          <button
            onClick={handleStartOver}
            className="mt-4 px-6 py-3 border border-white/10 hover:bg-white/5 rounded-full font-bold flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-all"
          >
            <RotateCcw className="w-4 h-4" /> Start Over
          </button>
        </div>

      </div>
    </StepLayout>
  );
}
