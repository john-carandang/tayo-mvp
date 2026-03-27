import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { FileText, ArrowRight, Loader2 } from "lucide-react";
import { StepLayout } from "@/components/layout/StepLayout";
import { useTayoState } from "@/hooks/use-tayo-state";
import { useGenerateHabits } from "@workspace/api-client-react";

export default function Plan() {
  const [, setLocation] = useLocation();
  const { state, updateState, isHydrated } = useTayoState();
  const { mutateAsync: generateHabits, isPending } = useGenerateHabits();

  useEffect(() => {
    if (isHydrated && (!state.firstName || !state.plan)) {
      setLocation("/");
    }
  }, [isHydrated, state.firstName, state.plan, setLocation]);

  const handleNext = async () => {
    try {
      const res = await generateHabits({
        data: {
          strategicPlan: state.plan || "",
          firstName: state.firstName
        }
      });
      updateState({ habits: res.habits });
      setLocation("/habits");
    } catch (error) {
      console.error("Failed to generate habits", error);
      // Proceed anyway to not block
      setLocation("/habits");
    }
  };

  if (!isHydrated || !state.plan) return null;

  // Simple parsing to render the markdown-like text beautifully
  const sections = state.plan.split('\n\n').filter(Boolean);

  return (
    <StepLayout step={4} title="Personal Strategic Plan">
      <div className="max-w-3xl mx-auto mb-24">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-white/10 rounded-t-3xl rounded-b-xl overflow-hidden shadow-2xl relative"
        >
          <div className="h-2 bg-gradient-to-r from-primary via-primary/50 to-background w-full" />
          
          <div className="p-8 sm:p-12 prose prose-invert prose-p:text-muted-foreground prose-headings:font-display prose-headings:text-white max-w-none">
            
            <div className="flex items-center gap-3 text-primary mb-8 border-b border-white/10 pb-6">
              <FileText className="w-8 h-8" />
              <h2 className="text-3xl font-display font-bold m-0 text-white">Strategy Document</h2>
            </div>

            <div className="space-y-8">
              {sections.map((section, idx) => {
                // If it looks like a header (starts with # or is short and ends with :)
                if (section.startsWith('#') || (section.length < 50 && section.endsWith(':'))) {
                  return (
                    <h3 key={idx} className="text-xl text-primary mt-8 mb-4 border-l-2 border-primary pl-4">
                      {section.replace(/^#+\s*/, '')}
                    </h3>
                  );
                }
                
                // Bullet points
                if (section.startsWith('-') || section.startsWith('*')) {
                  const items = section.split('\n');
                  return (
                    <ul key={idx} className="space-y-2 pl-4 text-base">
                      {items.map((item, i) => (
                        <li key={i} className="text-muted-foreground">{item.replace(/^[-*]\s*/, '')}</li>
                      ))}
                    </ul>
                  );
                }

                // Normal paragraph
                return <p key={idx} className="text-base leading-relaxed">{section}</p>;
              })}
            </div>
          </div>
        </motion.div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleNext}
            disabled={isPending}
            className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold text-lg flex items-center gap-3 shadow-[0_0_40px_rgba(184,245,102,0.3)] hover:scale-105 hover:shadow-[0_0_60px_rgba(184,245,102,0.4)] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {isPending ? (
              <>Generating Action Plan <Loader2 className="w-5 h-5 animate-spin" /></>
            ) : (
              <>Build My Habits & Goals <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
        </div>

      </div>
    </StepLayout>
  );
}
