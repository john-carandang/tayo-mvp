import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";

export default function SignUp() {
  const [, setLocation] = useLocation();
  const { signUp, signInWithGoogle, loading, user } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!loading && user) {
    const hasProfile = localStorage.getItem("tayo_coach_id");
    setLocation(hasProfile ? "/dashboard" : "/disclosures");
    return null;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!firstName.trim()) { setAuthError("Please enter your first name."); return; }
    setAuthLoading(true);
    const { error, needsConfirmation } = await signUp(email.trim(), password, firstName.trim(), lastName.trim());
    setAuthLoading(false);
    if (error) { setAuthError(error); return; }
    if (needsConfirmation) { setShowConfirm(true); return; }
    setLocation("/disclosures");
  };

  const handleGoogle = async () => {
    setAuthError("");
    const { error } = await signInWithGoogle();
    if (error) setAuthError(error);
  };

  if (showConfirm) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh] px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            <div
              className="rounded-2xl p-8 shadow-lg text-center"
              style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)" }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: "rgba(122,158,135,0.15)" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="#7A9E87" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="font-display text-xl mb-3" style={{ color: "#2C1810" }}>Check your email</h2>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "#746A5A" }}>
                We sent a confirmation link to <span className="font-medium" style={{ color: "#2C1810" }}>{email}</span>. Click it to confirm your account, then sign in.
              </p>
              <button
                onClick={() => setLocation("/login")}
                className="w-full py-3 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
              >
                Go to sign in
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      <Navbar />
      <div className="flex items-center justify-center min-h-[80vh] px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div
            className="rounded-2xl p-8 shadow-lg"
            style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)" }}
          >
            <h1 className="font-display text-2xl text-center mb-2" style={{ color: "#2C1810" }}>
              Welcome to Tayo
            </h1>
            <p className="text-xs text-center mb-6" style={{ color: "#9B8E84" }}>
              Create your account to begin your journey.
            </p>

            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-medium text-sm mb-3 transition-all hover:opacity-90 border"
              style={{ backgroundColor: "#fff", borderColor: "rgba(44,24,16,0.15)", color: "#2C1810" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(44,24,16,0.1)" }} />
              <span className="text-xs" style={{ color: "#9B8E84" }}>or</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(44,24,16,0.1)" }} />
            </div>

            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#5C4A3D" }}>First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                    maxLength={100}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: "#F5F0E8", border: "1.5px solid rgba(44,24,16,0.2)", color: "#2C1810" }}
                    placeholder="Alex"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#5C4A3D" }}>Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: "#F5F0E8", border: "1.5px solid rgba(44,24,16,0.2)", color: "#2C1810" }}
                    placeholder="Kim"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#5C4A3D" }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: "#F5F0E8", border: "1.5px solid rgba(44,24,16,0.2)", color: "#2C1810" }}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#5C4A3D" }}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none pr-10"
                    style={{ backgroundColor: "#F5F0E8", border: "1.5px solid rgba(44,24,16,0.2)", color: "#2C1810" }}
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "#9B8E84" }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {authError && (
                <p className="text-xs text-center" style={{ color: "#C4622D" }}>{authError}</p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 mt-1"
                style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
              >
                {authLoading ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="text-center text-xs mt-4" style={{ color: "#9B8E84" }}>
              Already have an account?{" "}
              <button
                onClick={() => setLocation("/login")}
                className="underline"
                style={{ color: "#7A9E87" }}
              >
                Sign in
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
