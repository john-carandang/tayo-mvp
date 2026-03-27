import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { StepLayout } from "@/components/layout/StepLayout";
import { LikertScale } from "@/components/ui/LikertScale";
import { useTayoState } from "@/hooks/use-tayo-state";
import { useGenerateNarrative } from "@workspace/api-client-react";

const DIMENSION_DESCRIPTIONS = [
  "Your relationship with your thoughts, emotions, and inner life, including stress, self-awareness, and psychological resilience.",
  "How engaged, purposeful, and fulfilled you feel in your work, and how well it aligns with your values and strengths.",
  "How well you are caring for your body, including sleep, movement, nutrition, and physical energy.",
  "The quality of your relationships and sense of belonging, including friendships, family, and community.",
  "Your sense of security, control, and alignment around money, including how you earn, spend, and plan for the future."
];

export default function Intake() {
  const [, setLocation] = useLocation();
  const { state, updateState } = useTayoState();
  const { mutateAsync: generateNarrative, isPending } = useGenerateNarrative();
  
  const [localState, setLocalState] = useState(state);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync back to context when proceeding
  const handleContinue = async () => {
    updateState(localState);
    
    console.log("[tayo] Intake → calling /api/generate-narrative", {
      firstName: localState.firstName,
      dimensionCount: localState.dimensions.length,
    });

    try {
      const response = await generateNarrative({
        data: {
          firstName: localState.firstName,
          dimensions: localState.dimensions
        }
      });
      
      console.log("[tayo] /api/generate-narrative raw response →", response);
      console.log("[tayo] narrative length →", response?.narrative?.length ?? "MISSING");

      updateState({ narrative: response.narrative });

      console.log("[tayo] updateState called with narrative — navigating to /dashboard");
      setLocation("/dashboard");
    } catch (error) {
      console.error("[tayo] /api/generate-narrative FAILED →", error);
      setLocation("/dashboard");
    }
  };

  const updateDimension = (index: number, field: string, value: any) => {
    const newDims = [...localState.dimensions];
    newDims[index] = { ...newDims[index], [field]: value };
    setLocalState({ ...localState, dimensions: newDims });
  };

  const isFormValid = 
    localState.firstName.trim().length > 0 &&
    localState.dimensions.every(d => d.importance > 0 && d.thriving > 0 && d.openText.trim().length > 5);

  return (
    <StepLayout step={1} title="Let's establish your baseline.">
      <div className="max-w-2xl mx-auto space-y-16 pb-32" ref={containerRef}>
        
        {/* Name Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card p-6 md:p-8 rounded-2xl border border-white/5 shadow-2xl"
        >
          <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            What should we call you?
          </label>
          <input
            type="text"
            value={localState.firstName}
            onChange={(e) => setLocalState({...localState, firstName: e.target.value})}
            placeholder="Your first name"
            className="w-full bg-transparent border-b-2 border-white/10 pb-2 text-3xl font-display text-white focus:outline-none focus:border-primary transition-colors placeholder:text-white/20"
          />
        </motion.div>

        {/* Dimensions */}
        <AnimatePresence>
          {localState.firstName.trim().length > 0 && localState.dimensions.map((dim, idx) => (
            <motion.div 
              key={dim.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-card p-6 md:p-8 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden"
            >
              {/* Subtle indicator line */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-transparent" />
              
              <h2 className="text-2xl font-display mb-2">{dim.name}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">{DIMENSION_DESCRIPTIONS[idx]}</p>

              <div className="space-y-8">
                <div>
                  <label className="block font-semibold mb-3">How much are you <span className="text-primary">thriving</span> in this area right now?</label>
                  <LikertScale 
                    value={dim.thriving} 
                    onChange={(v) => updateDimension(idx, 'thriving', v)} 
                    labelLeft="Struggling"
                    labelRight="Thriving"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-3">How <span className="text-white">important</span> is this area to you personally?</label>
                  <LikertScale 
                    value={dim.importance} 
                    onChange={(v) => updateDimension(idx, 'importance', v)} 
                    labelLeft="Not at all"
                    labelRight="Deeply"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-3">Tell us more.</label>
                  <p className="text-xs text-muted-foreground mb-3">What's driving these scores? Has anything been shifting recently?</p>
                  <textarea
                    value={dim.openText}
                    onChange={(e) => updateDimension(idx, 'openText', e.target.value)}
                    placeholder="Aim for 2-3 thoughtful sentences..."
                    className="w-full h-32 bg-background/50 border border-white/10 rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none placeholder:text-white/20"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

      </div>

      {/* Sticky Bottom Bar */}
      <AnimatePresence>
        {isFormValid && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent z-50 flex justify-center"
          >
            <button
              onClick={handleContinue}
              disabled={isPending}
              className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold text-lg flex items-center gap-3 shadow-[0_0_40px_rgba(184,245,102,0.3)] hover:scale-105 hover:shadow-[0_0_60px_rgba(184,245,102,0.4)] transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              {isPending ? (
                <>Generating your dashboard <Loader2 className="w-5 h-5 animate-spin" /></>
              ) : (
                <>Continue to Your Dashboard <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </StepLayout>
  );
}
