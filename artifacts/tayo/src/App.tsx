import { type ComponentType, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DemoProvider, useDemo } from "@/contexts/DemoContext";
import { useLocation } from "wouter";

import Landing from "./pages/Landing";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import Disclosures from "./pages/Disclosures";
import CoachSelect from "./pages/CoachSelect";
import Warmup from "./pages/Warmup";
import Intake from "./pages/Intake";
import Dashboard from "./pages/Dashboard";
import FAQ from "./pages/FAQ";
import NextMoves from "./pages/NextMoves";
import Profile from "./pages/Profile";
import Demo from "./pages/Demo";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(196,98,45,0.2)", borderTopColor: "#C4622D" }} />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const { user, loading } = useAuth();
  const { isDemoMode } = useDemo();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isDemoMode && !loading && !user) setLocation("/sign-up");
  }, [isDemoMode, loading, user, setLocation]);

  if (isDemoMode) return <Component />;
  if (loading) return <LoadingScreen />;
  if (!user) return <LoadingScreen />;
  return <Component />;
}

function ChatRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/intake"); }, [setLocation]);
  return null;
}

function PlanRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/dashboard"); }, [setLocation]);
  return null;
}

function DemoBanner() {
  const { isDemoMode, bannerVisible, dismissBanner } = useDemo();
  if (!isDemoMode || !bannerVisible) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 32,
        zIndex: 9999,
        backgroundColor: "#1C1812",
        color: "#D4A847",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <span>Demo mode — mock data only. Not a real user session.</span>
      <button
        onClick={dismissBanner}
        style={{
          position: "absolute",
          right: 12,
          background: "none",
          border: "none",
          color: "#D4A847",
          fontSize: 14,
          cursor: "pointer",
          lineHeight: 1,
          padding: "0 4px",
        }}
        aria-label="Dismiss demo banner"
      >
        ✕
      </button>
    </div>
  );
}

function AppShell() {
  const { isDemoMode, bannerVisible } = useDemo();
  const bannerOffset = isDemoMode && bannerVisible ? 32 : 0;

  return (
    <div style={{ paddingTop: bannerOffset }}>
      <DemoBanner />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/sign-up" component={SignUp} />
        <Route path="/login" component={Login} />
        <Route path="/faq" component={FAQ} />
        <Route path="/demo" component={Demo} />
        <Route path="/disclosures" component={() => <ProtectedRoute component={Disclosures} />} />
        <Route path="/coach" component={() => <ProtectedRoute component={CoachSelect} />} />
        <Route path="/warmup" component={() => <ProtectedRoute component={Warmup} />} />
        <Route path="/intake" component={() => <ProtectedRoute component={Intake} />} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/next-moves" component={() => <ProtectedRoute component={NextMoves} />} />
        <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
        <Route path="/chat" component={() => <ProtectedRoute component={ChatRedirect} />} />
        <Route path="/plan" component={() => <ProtectedRoute component={PlanRedirect} />} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DemoProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppShell />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </DemoProvider>
    </QueryClientProvider>
  );
}

export default App;
