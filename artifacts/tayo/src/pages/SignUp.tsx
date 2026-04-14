import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh", position: "relative" }}>

      {/* ── PAGE-LEVEL LOGO BAR — transparent, above both panels ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          padding: "16px 28px",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setLocation("/")}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 500,
            color: "#C4622D",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Tayo
        </button>
      </div>

      {/* ── LEFT PANEL — form ────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "#F7F0E0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "80px 24px 48px",
          gridColumn: "1",
        }}
        className="col-span-2 md:col-span-1"
      >
        <div style={{ width: "100%", maxWidth: 400, padding: "0 32px" }}>

          {showConfirm ? (
            /* ── Email confirmation state ── */
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  backgroundColor: "rgba(42,107,99,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="#2A6B63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, color: "#1C1812", marginBottom: 12 }}>
                Check your email
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "#7a5c44", marginBottom: 24, fontFamily: "var(--font-display)" }}>
                We sent a confirmation link to <strong style={{ color: "#1C1812", fontWeight: 500 }}>{email}</strong>. Click it to confirm your account, then sign in.
              </p>
              <button
                onClick={() => setLocation("/login")}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 500,
                  backgroundColor: "#C4622D",
                  color: "#F7F0E0",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Go to sign in
              </button>
            </div>
          ) : (
            /* ── Sign-up form ── */
            <>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, color: "#1C1812", textAlign: "center", marginBottom: 8 }}>
                Welcome to Tayo
              </h1>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "#7a5c44", textAlign: "center", marginBottom: 32 }}>
                Create your account to begin your journey.
              </p>

              {/* Google OAuth */}
              <button
                onClick={handleGoogle}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: "10px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 500,
                  backgroundColor: "#fff",
                  border: "1px solid rgba(60,40,20,0.2)",
                  color: "#1C1812",
                  cursor: "pointer",
                  marginBottom: 20,
                  transition: "opacity 150ms",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(60,40,20,0.12)" }} />
                <span style={{ fontSize: 13, color: "#8a7060" }}>or</span>
                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(60,40,20,0.12)" }} />
              </div>

              <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {/* First + Last name */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "#5a4a3f", marginBottom: 4 }}>
                      First name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      required
                      maxLength={100}
                      autoComplete="given-name"
                      placeholder="Cesar"
                      className="auth-input"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 15, backgroundColor: "#fff", border: "1px solid rgba(60,40,20,0.2)", color: "#1C1812", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "#5a4a3f", marginBottom: 4 }}>
                      Last name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      maxLength={100}
                      autoComplete="family-name"
                      placeholder="Pascual"
                      className="auth-input"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 15, backgroundColor: "#fff", border: "1px solid rgba(60,40,20,0.2)", color: "#1C1812", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Email */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "#5a4a3f", marginBottom: 4 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="auth-input"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 15, backgroundColor: "#fff", border: "1px solid rgba(60,40,20,0.2)", color: "#1C1812", outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "#5a4a3f", marginBottom: 4 }}>
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      className="auth-input"
                      style={{ width: "100%", padding: "10px 40px 10px 14px", borderRadius: 8, fontSize: 15, backgroundColor: "#fff", border: "1px solid rgba(60,40,20,0.2)", color: "#1C1812", outline: "none", boxSizing: "border-box" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8a7060", display: "flex", alignItems: "center" }}
                    >
                      {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                    </button>
                  </div>
                </div>

                {authError && (
                  <p style={{ fontSize: 13, color: "#C4622D", textAlign: "center", marginBottom: 12 }}>{authError}</p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 500,
                    backgroundColor: authLoading ? "rgba(196,98,45,0.6)" : "#C4622D",
                    color: "#F7F0E0",
                    border: "none",
                    cursor: authLoading ? "not-allowed" : "pointer",
                    transition: "background-color 150ms",
                  }}
                >
                  {authLoading ? "Creating account…" : "Create account"}
                </button>
              </form>

              <p style={{ fontSize: 14, color: "#7a5c44", textAlign: "center", marginTop: 16 }}>
                Already have an account?{" "}
                <button
                  onClick={() => setLocation("/login")}
                  style={{ fontWeight: 500, color: "#2A6B63", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL — living room photo ──────────────────────────────── */}
      <div
        className="hidden md:block"
        style={{
          backgroundImage: `url(${BASE_URL}/assets/living-room.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          minHeight: "100vh",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      />
    </div>
  );
}
