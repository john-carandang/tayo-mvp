import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Plan() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/dashboard");
  }, []);

  return null;
}
