import { useEffect } from "react";
import { useLocation } from "wouter";
import { useDemo } from "@/contexts/DemoContext";
import NotFound from "./not-found";

declare const __DEMO_MODE_ENABLED__: boolean;

export default function Demo() {
  const [, setLocation] = useLocation();
  const { enableDemo } = useDemo();

  const isEnabled = (() => {
    try { return __DEMO_MODE_ENABLED__; } catch { return false; }
  })();

  useEffect(() => {
    if (!isEnabled) return;
    enableDemo();
    setLocation("/dashboard");
  }, [isEnabled, enableDemo, setLocation]);

  if (!isEnabled) return <NotFound />;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
    </div>
  );
}
