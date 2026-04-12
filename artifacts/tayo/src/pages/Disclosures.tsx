import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const DISCLOSURES = [
  "Tayo is an AI coaching tool, not a human coach. You are interacting with artificial intelligence.",
  "Tayo is a coaching service designed to support self-understanding and personal growth. It is not a mental health service, therapy, or crisis support. If you are experiencing a mental health crisis, please contact a professional immediately.",
  "Tayo's coaching approach is aligned with ICF Core Competencies (2025) and ICF AI Coaching Standards. It is not a substitute for working with a credentialed human coach. Find an ICF coach at coachingfederation.org/get-coaching/",
  "Your coaching conversations and personal data are stored securely and used only to personalize your Tayo experience. They are never sold to third parties.",
  "You may request deletion of your data at any time by contacting us.",
  "You may end your coaching relationship with Tayo at any time for any reason.",
];

export default function Disclosures() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const [checked, setChecked] = useState<boolean[]>(new Array(DISCLOSURES.length).fill(false));
  const [saving, setSaving] = useState(false);

  const allChecked = checked.every(Boolean);

  const toggle = (i: number) => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v));

  const handleContinue = async () => {
    if (!allChecked) return;
    setSaving(true);
    try {
      const token = getToken();
      if (token) {
        await fetch(`${BASE_URL}/api/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ consent_acknowledged: true }),
        });
      }
    } catch { /* continue regardless */ }
    setSaving(false);
    setLocation("/coach");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ backgroundColor: "#F5F0E8" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-10">
          <button onClick={() => setLocation("/")} className="font-display text-xl font-semibold mb-8 block mx-auto" style={{ color: "#2C1810" }}>
            Tayo
          </button>
          <h1 className="font-display text-3xl mb-3" style={{ color: "#2C1810" }}>Before we begin</h1>
          <p className="text-sm" style={{ color: "#746A5A" }}>Please read and acknowledge each of the following. Your honesty with yourself starts here.</p>
        </div>

        <div className="rounded-2xl p-8 mb-8 space-y-5" style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)", boxShadow: "0 4px 24px rgba(44,24,16,0.06)" }}>
          {DISCLOSURES.map((text, i) => (
            <motion.label
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-4 cursor-pointer items-start group"
            >
              <div
                onClick={() => toggle(i)}
                className="w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-all"
                style={{
                  backgroundColor: checked[i] ? "#7A9E87" : "transparent",
                  borderColor: checked[i] ? "#7A9E87" : "rgba(44,24,16,0.3)",
                }}
              >
                {checked[i] && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#F5F0E8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <p
                onClick={() => toggle(i)}
                className="text-sm leading-relaxed select-none"
                style={{ color: checked[i] ? "#2C1810" : "#746A5A" }}
              >
                {text}
              </p>
            </motion.label>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={handleContinue}
            disabled={!allChecked || saving}
            className="px-10 py-4 rounded-full font-semibold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: allChecked ? "#C4622D" : "#9B8E84", color: "#F5F0E8" }}
          >
            {saving ? "Saving…" : allChecked ? "I understand — continue" : `Acknowledge all ${checked.filter(Boolean).length}/${DISCLOSURES.length} to continue`}
          </button>
          <p className="text-xs mt-4" style={{ color: "#9B8E84" }}>Your acknowledgement is saved securely to your account.</p>
        </div>
      </motion.div>
    </div>
  );
}
