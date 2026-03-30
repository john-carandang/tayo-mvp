import { ReactNode } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { StepIndicator } from "@/components/ui/StepIndicator";

interface StepLayoutProps {
  children: ReactNode;
  step: number;
  title?: string;
  subtitle?: string;
}

export function StepLayout({ children, step, title, subtitle }: StepLayoutProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(224,112,32,0.06) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(99,136,99,0.06) 0%, transparent 70%)" }} />
      </div>

      <header className="w-full pt-6 pb-4 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setLocation("/")}
              className="font-display text-xl font-semibold text-foreground hover:text-primary transition-colors"
            >
              Tayo
            </button>

            <StepIndicator currentStep={step} />

            <div className="sm:hidden text-xs font-medium text-muted-foreground">
              {step} / 4
            </div>
          </div>

          {title && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center py-4"
            >
              <h1 className="text-2xl md:text-3xl font-display text-foreground mb-1">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </motion.div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 relative z-10 pb-16">
        {children}
      </main>
    </div>
  );
}
