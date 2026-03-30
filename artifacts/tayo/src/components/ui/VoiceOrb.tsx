import { cn } from "@/lib/utils";

export type OrbState = "idle" | "speaking" | "listening" | "processing";

interface VoiceOrbProps {
  state: OrbState;
  size?: number;
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
}

export function VoiceOrb({ state, size = 160, onClick, label, disabled }: VoiceOrbProps) {
  const ringSize = size * 1.35;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative flex items-center justify-center cursor-pointer"
        style={{ width: ringSize, height: ringSize }}
        onClick={!disabled ? onClick : undefined}
      >
        {(state === "speaking" || state === "listening") && (
          <>
            <div
              className="absolute rounded-full animate-ring"
              style={{
                width: size,
                height: size,
                background: state === "speaking"
                  ? "rgba(224, 112, 32, 0.2)"
                  : "rgba(99, 136, 99, 0.2)",
              }}
            />
            <div
              className="absolute rounded-full animate-ring-delay"
              style={{
                width: size,
                height: size,
                background: state === "speaking"
                  ? "rgba(224, 112, 32, 0.15)"
                  : "rgba(99, 136, 99, 0.15)",
              }}
            />
          </>
        )}

        <div
          className={cn(
            "rounded-full transition-all duration-500 relative",
            state === "idle" && "orb-idle animate-orb-pulse",
            state === "speaking" && "orb-speaking animate-orb-speak",
            state === "listening" && "orb-listening animate-orb-listen",
            state === "processing" && "orb-idle animate-orb-pulse opacity-70",
          )}
          style={{ width: size, height: size }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, transparent 60%)",
            }}
          />

          {state === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {label && (
        <p className="text-sm font-medium text-muted-foreground text-center max-w-40">
          {label}
        </p>
      )}
    </div>
  );
}
