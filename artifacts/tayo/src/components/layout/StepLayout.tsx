import { ReactNode } from "react";
import { motion } from "framer-motion";

interface StepLayoutProps {
  children: ReactNode;
  step: number;
  title?: string;
}

export function StepLayout({ children, step, title }: StepLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col relative pb-24">
      {/* Decorative background gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <header className="w-full pt-8 pb-4 px-6 flex flex-col items-center justify-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-6"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Step {step} of 5
        </motion.div>
        
        {title && (
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-3xl font-display text-center mb-4"
          >
            {title}
          </motion.h1>
        )}
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        {children}
      </main>
    </div>
  );
}
