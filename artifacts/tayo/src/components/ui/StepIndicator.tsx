import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Voice Intake", path: "/" },
  { label: "Your Dashboard", path: "/dashboard" },
  { label: "Coaching Session", path: "/chat" },
  { label: "Strategic Plan", path: "/plan" },
];

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="hidden sm:flex items-center gap-1">
      {STEPS.map((s, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;
        const isClickable = isDone;

        return (
          <div key={i} className="flex items-center gap-1">
            <button
              onClick={() => isClickable && setLocation(s.path)}
              disabled={!isClickable && !isActive}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-full transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isDone
                    ? "text-muted-foreground hover:text-foreground cursor-pointer"
                    : "text-muted-foreground/40 cursor-default"
              )}
            >
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "w-4 h-px",
                isDone ? "bg-foreground/25" : "bg-foreground/10"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
