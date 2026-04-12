import { type ComponentType } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import Landing from "./pages/Landing";
import Disclosures from "./pages/Disclosures";
import CoachSelect from "./pages/CoachSelect";
import Warmup from "./pages/Warmup";
import Intake from "./pages/Intake";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Plan from "./pages/Plan";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>;
  if (!user) {
    window.location.href = import.meta.env.BASE_URL?.replace(/\/$/, "") || "/";
    return null;
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/disclosures" component={() => <ProtectedRoute component={Disclosures} />} />
      <Route path="/coach" component={() => <ProtectedRoute component={CoachSelect} />} />
      <Route path="/warmup" component={() => <ProtectedRoute component={Warmup} />} />
      <Route path="/intake" component={() => <ProtectedRoute component={Intake} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
      <Route path="/plan" component={() => <ProtectedRoute component={Plan} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
