import { cn } from "@/lib/utils";

interface LikertScaleProps {
  value: number;
  onChange: (val: number) => void;
  labelLeft?: string;
  labelRight?: string;
}

export function LikertScale({ value, onChange, labelLeft = "Low", labelRight = "High" }: LikertScaleProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between w-full gap-1 sm:gap-2 mb-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={cn(
              "flex-1 aspect-square sm:aspect-auto sm:py-3 rounded-md text-sm font-semibold transition-all duration-200 border",
              value === num
                ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(184,245,102,0.3)] scale-105"
                : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-white/5"
            )}
          >
            {num}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider font-semibold px-1">
        <span>{labelLeft}</span>
        <span>{labelRight}</span>
      </div>
    </div>
  );
}
