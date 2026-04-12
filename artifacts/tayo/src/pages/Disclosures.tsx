import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function Disclosures() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
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
          <button
            onClick={() => setLocation("/")}
            className="font-display text-xl font-semibold mb-8 block mx-auto transition-opacity hover:opacity-70"
            style={{ color: "#2C1810" }}
          >
            Tayo
          </button>
          <h1 className="font-display text-3xl mb-3" style={{ color: "#2C1810" }}>Before we begin</h1>
          <p className="text-sm" style={{ color: "#746A5A" }}>
            Please read the following. Your honesty with yourself starts here.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-7"
            style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)", boxShadow: "0 2px 12px rgba(44,24,16,0.04)" }}
          >
            <h3 className="font-display text-base mb-3" style={{ color: "#2C1810" }}>What Tayo is — and isn't</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#746A5A" }}>
              Tayo is an AI coaching tool designed to support self-understanding and personal growth. It is not a human coach, a therapist, or a mental health service. If you are experiencing a mental health crisis, please contact a professional immediately.
            </p>
            <p className="text-sm leading-relaxed mt-3" style={{ color: "#746A5A" }}>
              Tayo's coaching approach is aligned with ICF Core Competencies (2025) and ICF AI Coaching Standards — it is not a substitute for working with a credentialed human coach. Find one at{" "}
              <a
                href="https://coachingfederation.org/get-coaching/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "#7A9E87" }}
              >
                coachingfederation.org/get-coaching/
              </a>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-7"
            style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)", boxShadow: "0 2px 12px rgba(44,24,16,0.04)" }}
          >
            <h3 className="font-display text-base mb-3" style={{ color: "#2C1810" }}>How your data is used</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#746A5A" }}>
              Your coaching conversations and personal data are stored securely and used only to personalise your Tayo experience. They are never sold to third parties. You may request deletion of your data at any time, and you may end your relationship with Tayo at any time for any reason.
            </p>
          </motion.div>
        </div>

        <div className="text-center">
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleContinue}
            disabled={saving}
            className="px-10 py-4 rounded-full font-semibold text-base transition-all disabled:opacity-50 hover:scale-105 shadow-md"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            {saving ? "Saving…" : "Acknowledge & continue"}
          </motion.button>
          <p className="text-xs mt-4" style={{ color: "#9B8E84" }}>
            Your acknowledgement is saved securely to your account.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
