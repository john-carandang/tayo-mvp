import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { MessageSquare, Loader2, Target, Zap, LayoutGrid } from "lucide-react";
import { StepLayout } from "@/components/layout/StepLayout";
import { useTayoState } from "@/hooks/use-tayo-state";
import { PentagonChart } from "@/components/dashboard/PentagonChart";
import { QuadrantChart } from "@/components/dashboard/QuadrantChart";
import { cn } from "@/lib/utils";

type Tab = "snapshot" | "progress" | "focus";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { state, isHydrated } = useTayoState();
  const [activeTab, setActiveTab] = useState<Tab>("snapshot");

  useEffect(() => {
    console.log("[tayo] Dashboard mounted — state.narrative →", state.narrative ?? "MISSING");
    console.log("[tayo] Dashboard — localStorage snapshot →",
      localStorage.getItem("tayo_session")?.slice(0, 200));
  }, []);

  useEffect(() => {
    if (isHydrated && !state.firstName) {
      setLocation("/");
    }
  }, [isHydrated, state.firstName, setLocation]);

  if (!isHydrated || !state.firstName) return null;

  const sortedDimensions = [...state.dimensions].sort((a, b) => b.importance - a.importance);

  return (
    <StepLayout step={2} title="Your Holistic Dashboard">
      
      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-12">
        {(
          [
            { id: "snapshot", label: "Whole-Being Snapshot", icon: Target },
            { id: "progress", label: "Life Progress", icon: Zap },
            { id: "focus", label: "Where to Focus", icon: LayoutGrid },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 transition-all duration-300",
              activeTab === tab.id
                ? "bg-white text-black shadow-lg"
                : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full flex justify-center"
        >
          {activeTab === "snapshot" && (
            <PentagonChart dimensions={state.dimensions} firstName={state.firstName} />
          )}

          {activeTab === "progress" && (
            <div className="w-full max-w-2xl space-y-8 bg-card p-6 sm:p-10 rounded-3xl border border-white/5">
              {sortedDimensions.map((dim, i) => (
                <div key={dim.name} className="space-y-3">
                  <div className="flex justify-between items-end">
                    <h3 className="font-display text-xl">{dim.name}</h3>
                    <div className="text-xs font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                      Imp <span className="text-white">{dim.importance}</span> · Thr <span className="text-white">{dim.thriving}</span>
                    </div>
                  </div>
                  
                  {/* Importance dots */}
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <div 
                        key={j} 
                        className={cn(
                          "h-1.5 flex-1 rounded-full", 
                          j < dim.importance ? "bg-white/40" : "bg-white/5"
                        )} 
                      />
                    ))}
                  </div>

                  {/* Thriving Bar */}
                  <div className="h-4 bg-background rounded-full overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(dim.thriving / 10) * 100}%` }}
                      transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        dim.thriving >= 8 ? "bg-[#b8f566]" : dim.thriving >= 5 ? "bg-[#EF9F27]" : "bg-[#E24B4A]"
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "focus" && (
            <QuadrantChart dimensions={state.dimensions} />
          )}
        </motion.div>
      </div>

      {/* Persistent Narrative Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-16 w-full max-w-3xl mx-auto"
      >
        <div className="bg-card/50 backdrop-blur-md p-8 rounded-3xl border border-primary/20 shadow-[0_0_30px_rgba(184,245,102,0.05)]">
          <h3 className="text-primary font-bold text-sm tracking-widest uppercase mb-4 flex items-center gap-2">
            <SparklesIcon /> Narrative Insight
          </h3>
          
          {state.narrative ? (
            <p className="text-muted-foreground leading-relaxed text-base md:text-lg">
              {state.narrative}
            </p>
          ) : (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-full"></div>
              <div className="h-4 bg-white/5 rounded w-11/12"></div>
              <div className="h-4 bg-white/5 rounded w-10/12"></div>
              <div className="h-4 bg-white/5 rounded w-full"></div>
              <div className="h-4 bg-white/5 rounded w-3/4"></div>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setLocation("/chat")}
              disabled={!state.narrative}
              className="px-6 py-3 bg-white text-black rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              Discuss with your AI Coach <MessageSquare className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

    </StepLayout>
  );
}

function SparklesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  );
}
