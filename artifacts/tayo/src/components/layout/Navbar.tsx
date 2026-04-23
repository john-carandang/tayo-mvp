import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";

interface NavbarProps {
  firstName?: string;
  variant?: "transparent";
}

export function Navbar({ firstName, variant }: NavbarProps) {
  const [, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const { isDemoMode } = useDemo();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isTransparent = variant === "transparent";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const initial = (firstName ?? "U")[0].toUpperCase();

  const logoColor = isTransparent ? "#F7F0E0" : "#C4622D";
  const linkColor = isTransparent ? "#F7F0E0" : "#1C1812";
  const linkHoverColor = isTransparent ? "rgba(247,240,224,0.7)" : "rgba(28,24,18,0.5)";

  return (
    <header
      style={{
        width: "100%",
        padding: "16px 24px",
        position: isTransparent ? "relative" : "sticky",
        top: 0,
        zIndex: isTransparent ? 30 : 40,
        backgroundColor: isTransparent ? "transparent" : "#F7F0E0",
        borderBottom: isTransparent ? "none" : "1px solid rgba(42,107,99,0.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Logo */}
      <button
        onClick={() => setLocation("/")}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          fontWeight: 600,
          color: user && !isTransparent ? "#2C1810" : logoColor,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Tayo
      </button>

      {/* Center nav links */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
        }}
        className="hidden md:flex"
      >
        {(user || isDemoMode) ? (
          <>
            {(["Dashboard", "Next Moves", "FAQ"] as const).map((label) => {
              const href = label === "Dashboard" ? "/dashboard" : label === "Next Moves" ? "/next-moves" : "/faq";
              return (
                <button
                  key={label}
                  onClick={() => setLocation(href)}
                  style={{ fontSize: 15, color: "#1C1812", background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 150ms" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(28,24,18,0.5)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#1C1812")}
                >
                  {label}
                </button>
              );
            })}
          </>
        ) : (
          <>
            <button
              onClick={() => { setLocation("/"); setTimeout(() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }), 100); }}
              style={{ fontSize: 15, color: linkColor, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 150ms" }}
              onMouseEnter={e => (e.currentTarget.style.color = linkHoverColor)}
              onMouseLeave={e => (e.currentTarget.style.color = linkColor)}
            >
              How it works
            </button>
            <button
              onClick={() => setLocation("/faq")}
              style={{ fontSize: 15, color: linkColor, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 150ms" }}
              onMouseEnter={e => (e.currentTarget.style.color = linkHoverColor)}
              onMouseLeave={e => (e.currentTarget.style.color = linkColor)}
            >
              FAQ
            </button>
          </>
        )}
      </nav>

      {/* Right: profile or sign-up button */}
      {user ? (
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(s => !s)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 9999,
              padding: "6px 12px",
              backgroundColor: "rgba(196,98,45,0.08)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "rgba(196,98,45,0.2)",
                color: "#C4622D",
                fontWeight: 600,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initial}
            </div>
            <span className="hidden sm:block" style={{ fontSize: 14, fontWeight: 500, color: "#2C1810" }}>
              {firstName ?? "Account"}
            </span>
          </button>
          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 44,
                width: 192,
                borderRadius: 12,
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                zIndex: 50,
                paddingTop: 8,
                paddingBottom: 8,
                overflow: "hidden",
                backgroundColor: "#FFFDF8",
                border: "1px solid rgba(44,24,16,0.10)",
              }}
            >
              {[
                { label: "Profile",  href: "/profile" },
                { label: "Settings", href: "/profile?tab=settings" },
              ].map(({ label, href }) => (
                <button
                  key={label}
                  onClick={() => { setLocation(href); setDropdownOpen(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 14, color: "#2C1810", background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(247,240,224,0.5)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {label}
                </button>
              ))}
              <div style={{ borderTop: "1px solid rgba(44,24,16,0.08)", margin: "4px 0" }} />
              <button
                onClick={async () => { await signOut(); setLocation("/"); setDropdownOpen(false); }}
                style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 14, color: "#C4622D", background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(247,240,224,0.5)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <button
            onClick={() => setLocation("/sign-up")}
            className="hidden md:block"
            style={{
              fontSize: 12,
              padding: "7px 18px",
              borderRadius: 9999,
              fontWeight: 600,
              backgroundColor: "#C4622D",
              color: "#F7F0E0",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
              transition: "transform 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            Sign up / Log in
          </button>
          <button
            onClick={() => setLocation("/sign-up")}
            className="md:hidden"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 9999,
              fontWeight: 600,
              backgroundColor: "#C4622D",
              color: "#F7F0E0",
              border: "none",
              cursor: "pointer",
            }}
          >
            Start
          </button>
        </>
      )}
    </header>
  );
}
