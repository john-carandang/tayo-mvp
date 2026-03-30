import { useState, useEffect } from "react";

export interface TayoDimension {
  name: string;
  importance: number;
  thriving: number;
  tier: "foundational" | "growth" | "meaning";
  themes: string[];
  notableQuote: string;
}

export interface TayoLifeEvent {
  label: string;
  approximateYear: number;
  chapterName: string;
  actualizationLevel: number;
  type: "peak" | "valley" | "turning_point" | "stable";
}

export interface TayoProfile {
  firstName: string;
  dimensions: TayoDimension[];
  lifeEvents: TayoLifeEvent[];
  values: string[];
  purposeThemes: string[];
  overallNarrative: string;
}

const STORAGE_KEY = "tayo_profile";
const CHAT_KEY = "tayo_chat_history";
const PLAN_KEY = "tayo_plan";

export function useTayoProfile() {
  const [profile, setProfileState] = useState<TayoProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setProfileState(JSON.parse(raw));
      }
    } catch (_) {}
    setIsHydrated(true);
  }, []);

  const setProfile = (p: TayoProfile) => {
    setProfileState(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  };

  const clearProfile = () => {
    setProfileState(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CHAT_KEY);
    localStorage.removeItem(PLAN_KEY);
  };

  return { profile, setProfile, clearProfile, isHydrated };
}

export function useChatHistory() {
  const [history, setHistoryState] = useState<Array<{ role: string; content: string }>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      if (raw) setHistoryState(JSON.parse(raw));
    } catch (_) {}
  }, []);

  const setHistory = (h: Array<{ role: string; content: string }>) => {
    setHistoryState(h);
    localStorage.setItem(CHAT_KEY, JSON.stringify(h));
  };

  return { history, setHistory };
}

export function usePlan() {
  const [plan, setPlanState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      if (raw) setPlanState(raw);
    } catch (_) {}
  }, []);

  const savePlan = (p: string) => {
    setPlanState(p);
    localStorage.setItem(PLAN_KEY, p);
  };

  return { plan, savePlan };
}
