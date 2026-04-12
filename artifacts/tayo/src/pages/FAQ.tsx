import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const FAQS = [
  {
    q: "What is Tayo?",
    a: "Tayo is an AI coaching companion designed to support self-understanding and personal growth. Through voice conversations, Tayo helps you map your life story, clarify your values, understand your patterns, and build a meaningful path forward."
  },
  {
    q: "What is Tayo not?",
    a: "Tayo is not a human coach, a therapist, or a mental health service. It is an AI tool. If you are experiencing a mental health crisis or need clinical support, please reach out to a qualified mental health professional immediately."
  },
  {
    q: "How does Tayo's coaching approach work?",
    a: "Tayo's approach is aligned with ICF Core Competencies (2025) and ICF AI Coaching Standards — grounded in the belief that you are naturally creative, resourceful, and whole. Tayo asks the questions and creates the space for you to find your own answers. It is not a substitute for working with a credentialed human coach. Find one at coachingfederation.org/get-coaching/"
  },
  {
    q: "How often can I have a session?",
    a: "One session per 7 days. This rhythm is intentional — it gives you time to sit with what came up, do the work between sessions, and arrive at the next conversation with new ground to cover. Growth happens in the in-between."
  },
  {
    q: "What happens between sessions?",
    a: "Your Next Moves page keeps you on track between sessions. It holds your assignments (things you committed to during the session), curated resource recommendations tailored to your profile, and a live countdown to your next session."
  },
  {
    q: "How does Tayo protect my data?",
    a: "Your coaching conversations and personal data are stored securely and used only to personalise your Tayo experience. They are never sold to third parties. You can request deletion of your data at any time through your Profile settings. We use Supabase (SOC 2 compliant) for all data storage."
  },
  {
    q: "Can I change my coach?",
    a: "Yes. You can change your coach at any time through your Profile settings. Keep in mind that your coach selection does affect the voice and style of your sessions — it's worth listening to each voice before deciding."
  },
  {
    q: "Who is Tayo for?",
    a: "Tayo is built for people who are ready to do the inner work — who want to understand themselves more clearly, make sense of their story, and move intentionally toward a life that reflects what actually matters to them. It works best for people who show up honest and open."
  },
];

function FAQItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.08)" }}
    >
      <button
        onClick={() => setOpen(s => !s)}
        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
      >
        <span className="font-display text-base font-medium" style={{ color: "#2C1810" }}>{q}</span>
        <ChevronDown
          className="w-4 h-4 flex-shrink-0 transition-transform"
          style={{ color: "#9B8E84", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm leading-relaxed" style={{ color: "#746A5A" }}>{a}</p>
        </div>
      )}
    </motion.div>
  );
}

export default function FAQ() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl mb-4" style={{ color: "#2C1810" }}>
            About Tayo
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "#746A5A" }}>
            Everything you need to know before you begin — and as you go.
          </p>
        </motion.div>

        <div className="space-y-3 mb-16">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} delay={i * 0.05} />
          ))}
        </div>

        {!user && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center py-10 rounded-3xl"
            style={{ background: "linear-gradient(135deg, rgba(196,98,45,0.08) 0%, rgba(122,158,135,0.08) 100%)", border: "1px solid rgba(196,98,45,0.15)" }}
          >
            <h2 className="font-display text-2xl mb-3" style={{ color: "#2C1810" }}>
              Ready to begin?
            </h2>
            <p className="text-sm mb-6" style={{ color: "#746A5A" }}>
              Your first session is free. No credit card required.
            </p>
            <button
              onClick={() => setLocation("/sign-up")}
              className="px-8 py-3.5 rounded-full font-semibold text-sm transition-all hover:scale-105 shadow-md"
              style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
            >
              Begin your journey
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
