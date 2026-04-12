import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";

export default function Login() {
  const [, setLocation] = useLocation();
  const { signIn, signInWithGoogle, loading, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  if (!loading && user) {
    const hasProfile = localStorage.getItem("tayo_coach_id");
    setLocation(hasProfile ? "/dashboard" : "/disclosures");
    return null;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    const { error } = await signIn(email.trim(), password);
    setAuthLoading(false);
    if (error) { setAuthError(error); return; }
    const hasProfile = localStorage.getItem("tayo_coach_id");
    setLocation(hasProfile ? "/dashboard" : "/disclosures");
  };

  const handleGoogle = async () => {
    setAuthError("");
    const { error } = await signInWithGoogle();
    if (error) setAuthError(error);
  };

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
              Welcome back
            </h1>
            <p className="text-xs text-center mb-6" style={{ color: "#9B8E84" }}>
              Sign in to continue your journey.
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
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(44,24,16,0.1)" }} />
              <span className="text-xs" style={{ color: "#9B8E84" }}>or</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(44,24,16,0.1)" }} />
            </div>

            <form onSubmit={handleSignIn} className="space-y-3.5">
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
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none pr-10"
                    style={{ backgroundColor: "#F5F0E8", border: "1.5px solid rgba(44,24,16,0.2)", color: "#2C1810" }}
                    placeholder="Your password"
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
                {authLoading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="text-center text-xs mt-4" style={{ color: "#9B8E84" }}>
              New here?{" "}
              <button
                onClick={() => setLocation("/sign-up")}
                className="underline"
                style={{ color: "#7A9E87" }}
              >
                Create an account
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
