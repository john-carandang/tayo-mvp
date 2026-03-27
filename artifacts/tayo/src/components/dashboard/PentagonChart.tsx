import { useMemo } from "react";
import type { DimensionData } from "@workspace/api-client-react";
import { motion } from "framer-motion";

interface PentagonChartProps {
  dimensions: DimensionData[];
  firstName: string;
}

export function PentagonChart({ dimensions, firstName }: PentagonChartProps) {
  const size = 320;
  const center = size / 2;
  const maxRadius = 110;

  // Ensure we have exactly 5 dimensions in specific order, map to indices
  // Angles: -90 (top), -18, 54, 126, 198
  const points = useMemo(() => {
    return dimensions.map((dim, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      
      // Node size based on importance (1-10) -> 8px to 24px radius
      const nodeRadius = 8 + ((dim.importance - 1) / 9) * 16;
      
      // Color based on thriving
      let color = "#E24B4A"; // red (1-4)
      if (dim.thriving >= 8) color = "#b8f566"; // green (8-10)
      else if (dim.thriving >= 5) color = "#EF9F27"; // amber (5-7)

      // Distance from center (we'll keep nodes at maxRadius for the regular web shape)
      const x = center + maxRadius * Math.cos(angle);
      const y = center + maxRadius * Math.sin(angle);

      // Label positions (pushed out further)
      const labelRadius = maxRadius + 45;
      const labelX = center + labelRadius * Math.cos(angle);
      const labelY = center + labelRadius * Math.sin(angle);

      return { ...dim, x, y, angle, nodeRadius, color, labelX, labelY };
    });
  }, [dimensions, center, maxRadius]);

  const webPath = useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce((acc, point, i) => {
      return acc + (i === 0 ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`);
    }, "") + " Z";
  }, [points]);

  return (
    <div className="w-full flex flex-col items-center justify-center py-12">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          {/* Base Web (Background) */}
          <polygon 
            points={points.map(p => `${p.x},${p.y}`).join(" ")} 
            fill="rgba(255,255,255,0.02)" 
            stroke="rgba(255,255,255,0.1)" 
            strokeWidth="1"
          />
          
          {/* Inner concentric webs */}
          {[0.33, 0.66].map(scale => (
            <polygon 
              key={scale}
              points={points.map(p => `${center + (p.x - center) * scale},${center + (p.y - center) * scale}`).join(" ")} 
              fill="none" 
              stroke="rgba(255,255,255,0.05)" 
              strokeWidth="1"
            />
          ))}

          {/* Spokes */}
          {points.map((p, i) => (
            <line key={`spoke-${i}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          ))}

          {/* User Value Area (Filled based on thriving) */}
          <motion.polygon 
            initial={{ opacity: 0, scale: 0.8, transformOrigin: "center" }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            points={points.map(p => {
              const r = maxRadius * (p.thriving / 10);
              const x = center + r * Math.cos(p.angle);
              const y = center + r * Math.sin(p.angle);
              return `${x},${y}`;
            }).join(" ")}
            fill="url(#primaryGradient)"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            opacity="0.3"
          />

          <defs>
            <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
            </linearGradient>
            
            {/* Glow filters for nodes */}
            {points.map((p, i) => (
              <filter key={`glow-${i}`} id={`glow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            ))}
          </defs>

          {/* Nodes */}
          {points.map((p, i) => (
            <g key={`node-${i}`}>
              <motion.circle 
                initial={{ r: 0 }}
                animate={{ r: p.nodeRadius }}
                transition={{ delay: 0.5 + i * 0.1, type: "spring", stiffness: 200 }}
                cx={p.x} 
                cy={p.y} 
                fill={p.color}
                filter={`url(#glow-${i})`}
              />
              <circle cx={p.x} cy={p.y} r={p.nodeRadius} fill={p.color} stroke="#0a0a0a" strokeWidth="2" />
            </g>
          ))}

          {/* Labels */}
          {points.map((p, i) => {
            // Adjust text anchor based on position
            let anchor = "middle";
            if (p.x < center - 20) anchor = "end";
            if (p.x > center + 20) anchor = "start";
            
            return (
              <text 
                key={`label-${i}`} 
                x={p.labelX} 
                y={p.labelY} 
                textAnchor={anchor}
                dominantBaseline="middle"
                fill="hsl(var(--muted-foreground))"
                className="text-[11px] font-semibold uppercase tracking-wider"
              >
                {p.name.replace(" & ", " & \n")}
              </text>
            )
          })}

          {/* Center Text */}
          <circle cx={center} cy={center} r="4" fill="white" />
          <text x={center} y={center + 20} textAnchor="middle" fill="white" className="text-sm font-display font-bold">
            {firstName}'s Purpose
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-16 text-xs font-medium text-muted-foreground uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#E24B4A]" /> Struggling (1-4)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#EF9F27]" /> Building (5-7)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#b8f566]" /> Thriving (8-10)
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/60 mt-4 text-center max-w-xs">
        * Dot size reflects how <span className="text-white">important</span> this area is to you.
      </p>
    </div>
  );
}
