import { ReactNode } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

interface StepLayoutProps {
  children: ReactNode;
  step?: number;
  title?: string;
  subtitle?: string;
  description?: string;
}

export function StepLayout({ children, title, subtitle, description }: StepLayoutProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: "#F5F0E8" }}>
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(196,98,45,0.06) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(122,158,135,0.06) 0%, transparent 70%)" }}
        />
      </div>

      <header className="w-full pt-6 pb-4 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center mb-6">
            <button
              onClick={() => setLocation("/")}
              className="font-display text-xl font-semibold transition-colors hover:opacity-70"
              style={{ color: "#2C1810" }}
            >
              Tayo
            </button>
          </div>

          {title && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center py-4"
            >
              <h1 className="text-2xl md:text-3xl font-display mb-1" style={{ color: "#2C1810" }}>
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm" style={{ color: "#9B8E84" }}>{subtitle}</p>
              )}
              {description && (
                <p
                  style={{
                    color: "#9B8E84",
                    fontStyle: "italic",
                    fontSize: "13px",
                    textAlign: "center",
                    maxWidth: "480px",
                    margin: "10px auto 0",
                    lineHeight: "1.65",
                  }}
                >
                  {description}
                </p>
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
