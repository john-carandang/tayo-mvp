import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown } from "lucide-react";

const FAQS: Array<{ q: string; a: ReactNode }> = [
  {
    q: "What is Tayo?",
    a: "Tayo is an AI coaching companion designed to support self-understanding and personal growth. Through voice conversations, Tayo helps you understand your life journey, clarify your values, and build a meaningful path forward."
  },
  {
    q: "What is Tayo not?",
    a: "Tayo is not a human coach, a therapist, or a mental health service. It is an AI tool. If you are experiencing a mental health crisis or need clinical support, please reach out to a qualified mental health professional immediately."
  },
  {
    q: "Who is Tayo for?",
    a: "Tayo is built for people who are ready to do the inner work — who want to understand themselves more clearly, make sense of their story, and move intentionally toward a life that reflects what actually matters to them. It works best for people who show up honest and open."
  },
  {
    q: "How does Tayo's coaching approach work?",
    a: (
      <>
        <span>Tayo's approach is aligned with ICF Core Competencies (2025) and ICF AI Coaching Standards — grounded in the belief that you are naturally creative, resourceful, and whole. Tayo asks the questions and creates the space for you to find your own answers.</span>
        <br /><br />
        <span>What sets Tayo apart is its ability to learn and grow with you over time. Rather than starting from scratch each session, Tayo builds a living portrait of who you are — tracking your growth, surfacing patterns, and evolving your Strategic Plan as your life does. Your dashboard gives you a holistic, whole-person view across every dimension of your life, so progress is visible, not just felt. Tayo also draws on culturally grounded resources — surfacing content, frameworks, and tools that reflect your lived experience.</span>
      </>
    )
  },
  {
    q: "Is Tayo a human coach?",
    a: (
      <>
        No. Tayo is an AI coaching tool — not a human coach, therapist, or mental health provider. If you're looking for a credentialed human coach, you can find one through the International Coaching Federation's{" "}
        <a
          href="https://coachingfederation.org/get-coaching/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#2A6B63", textDecoration: "underline" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1C1812")}
          onMouseLeave={e => (e.currentTarget.style.color = "#2A6B63")}
        >
          website
        </a>
        .
      </>
    )
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
];

function FAQItem({ q, a, index }: { q: string; a: ReactNode; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "0.5px solid rgba(60,40,20,0.12)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(s => !s)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 17,
            fontWeight: 500,
            color: "#1C1812",
            lineHeight: 1.4,
          }}
        >
          {q}
        </span>
        <ChevronDown
          style={{
            width: 18,
            height: 18,
            flexShrink: 0,
            color: "#C4622D",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 250ms ease",
          }}
        />
      </button>
      {open && (
        <div style={{ padding: "0 28px 24px" }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              lineHeight: 1.8,
              color: "#5a4a3f",
            }}
          >
            {a}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F0E0" }}>
      <Navbar />

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "64px 24px 96px" }}>

        {/* Page header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 40,
              fontWeight: 500,
              color: "#1C1812",
              marginBottom: 14,
            }}
          >
            About Tayo
          </h1>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              color: "#7a5c44",
              lineHeight: 1.6,
            }}
          >
            Everything you need to know before you begin — and as you go.
          </p>
        </div>

        {/* Accordion list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 64 }}>
          {FAQS.map((faq, i) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} index={i} />
          ))}
        </div>

        {/* CTA card */}
        {!user && (
          <div
            style={{
              backgroundColor: "#E8D5A8",
              borderRadius: 16,
              padding: "48px 32px",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 32,
                fontWeight: 500,
                color: "#1C1812",
                marginBottom: 12,
              }}
            >
              Ready to begin?
            </h2>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 17,
                color: "#7a5c44",
                marginBottom: 28,
                lineHeight: 1.6,
              }}
            >
              Your first session is free. No credit card required.
            </p>
            <button
              onClick={() => setLocation("/sign-up")}
              style={{
                padding: "12px 32px",
                borderRadius: 9999,
                fontWeight: 600,
                fontSize: 15,
                backgroundColor: "#C4622D",
                color: "#F7F0E0",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 12px rgba(196,98,45,0.25)",
                transition: "transform 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              Begin your journey
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
