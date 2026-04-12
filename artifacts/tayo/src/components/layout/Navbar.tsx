import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

interface NavbarProps {
  firstName?: string;
}

export function Navbar({ firstName }: NavbarProps) {
  const [, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <header
      className="w-full px-6 py-4 sticky top-0 z-40"
      style={{ backgroundColor: "#F5F0E8", borderBottom: "1px solid rgba(44,24,16,0.07)" }}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <button
          onClick={() => setLocation("/")}
          className="font-display text-2xl font-semibold"
          style={{ color: "#2C1810" }}
        >
          Tayo
        </button>

        <nav className="hidden md:flex items-center gap-8">
          {user ? (
            <>
              <button
                onClick={() => setLocation("/dashboard")}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: "#5C4A3D" }}
              >
                Dashboard
              </button>
              <button
                onClick={() => setLocation("/next-moves")}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: "#5C4A3D" }}
              >
                Next Moves
              </button>
              <button
                onClick={() => setLocation("/faq")}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: "#5C4A3D" }}
              >
                FAQ
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setLocation("/");
                  setTimeout(() => {
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: "#5C4A3D" }}
              >
                How it works
              </button>
              <button
                onClick={() => setLocation("/faq")}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: "#5C4A3D" }}
              >
                FAQ
              </button>
            </>
          )}
        </nav>

        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(s => !s)}
              className="flex items-center gap-2.5 rounded-full px-3 py-1.5 transition-all hover:opacity-80"
              style={{ backgroundColor: "rgba(196,98,45,0.08)" }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs"
                style={{ backgroundColor: "rgba(196,98,45,0.2)", color: "#C4622D" }}
              >
                {initial}
              </div>
              <span className="hidden sm:block text-sm font-medium" style={{ color: "#2C1810" }}>
                {firstName ?? "Account"}
              </span>
            </button>
            {dropdownOpen && (
              <div
                className="absolute right-0 top-11 w-48 rounded-xl shadow-xl z-50 py-2 overflow-hidden"
                style={{ backgroundColor: "#FFFDF8", border: "1px solid rgba(44,24,16,0.1)" }}
              >
                <button
                  onClick={() => { setLocation("/profile"); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-amber-50/30"
                  style={{ color: "#2C1810" }}
                >
                  Profile
                </button>
                <button
                  onClick={() => { setLocation("/profile?tab=settings"); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-amber-50/30"
                  style={{ color: "#2C1810" }}
                >
                  Settings
                </button>
                <div style={{ borderTop: "1px solid rgba(44,24,16,0.08)", margin: "4px 0" }} />
                <button
                  onClick={async () => {
                    await signOut();
                    setLocation("/");
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-amber-50/30"
                  style={{ color: "#C4622D" }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setLocation("/sign-up")}
            className="px-5 py-2 rounded-full font-semibold text-sm transition-all hover:scale-105 shadow-sm"
            style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
          >
            Sign up / Log in
          </button>
        )}

        {/* Mobile menu (minimal) */}
        <div className="md:hidden flex items-center gap-3">
          {!user && (
            <button
              onClick={() => setLocation("/sign-up")}
              className="px-4 py-1.5 rounded-full font-semibold text-xs"
              style={{ backgroundColor: "#C4622D", color: "#F5F0E8" }}
            >
              Start
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
