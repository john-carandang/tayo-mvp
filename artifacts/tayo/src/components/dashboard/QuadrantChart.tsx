import { motion } from "framer-motion";
import type { DimensionData } from "@workspace/api-client-react/src/generated/api.schemas";
import { cn } from "@/lib/utils";

export function QuadrantChart({ dimensions }: { dimensions: DimensionData[] }) {
  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <div className="relative aspect-square sm:aspect-[4/3] w-full border border-white/10 rounded-2xl bg-white/[0.02] p-4 sm:p-8">
        
        {/* Crosshairs */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />

        {/* Axis Labels */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-2 w-full justify-center">
          <span className="hidden sm:inline">Low</span> 
          Importance 
          <span className="hidden sm:inline">High</span>
        </div>
        <div className="absolute top-1/2 -left-6 -translate-y-1/2 -rotate-90 text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-2 whitespace-nowrap">
          <span className="hidden sm:inline">Low</span> 
          Thriving 
          <span className="hidden sm:inline">High</span>
        </div>

        {/* Quadrant Background Labels */}
        <div className="absolute top-4 left-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/20">Surplus</div>
        <div className="absolute top-4 right-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/20">Strengths</div>
        <div className="absolute bottom-4 left-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/20">Dormant</div>
        <div className="absolute bottom-4 right-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary/30">Focus Areas</div>

        {/* Data Points */}
        <div className="relative w-full h-full">
          {dimensions.map((dim, i) => {
            // Map 1-10 to 0-100%
            const left = `${((dim.importance - 1) / 9) * 100}%`;
            const bottom = `${((dim.thriving - 1) / 9) * 100}%`;

            let color = "bg-[#E24B4A] text-white"; // red
            if (dim.thriving >= 8) color = "bg-[#b8f566] text-black"; // green
            else if (dim.thriving >= 5) color = "bg-[#EF9F27] text-black"; // amber

            return (
              <motion.div
                key={dim.name}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 + 0.2, type: "spring" }}
                className="absolute -translate-x-1/2 translate-y-1/2"
                style={{ left, bottom }}
              >
                <div className={cn("px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap shadow-lg", color)}>
                  {dim.name.split(" ")[0]}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
