import { useState, useEffect } from "react";
import type { DimensionData, ChatMessage } from "@workspace/api-client-react/src/generated/api.schemas";

export interface TayoState {
  firstName: string;
  dimensions: DimensionData[];
  narrative?: string;
  chatHistory: ChatMessage[];
  plan?: string;
  habits?: string;
}

const STORAGE_KEY = "tayo_session";

const INITIAL_STATE: TayoState = {
  firstName: "",
  dimensions: [
    { name: "Mental & Emotional", thriving: 0, importance: 0, openText: "" },
    { name: "Career", thriving: 0, importance: 0, openText: "" },
    { name: "Physical", thriving: 0, importance: 0, openText: "" },
    { name: "Social & Relationships", thriving: 0, importance: 0, openText: "" },
    { name: "Financial", thriving: 0, importance: 0, openText: "" },
  ],
  chatHistory: [],
};

export function useTayoState() {
  const [state, setState] = useState<TayoState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : INITIAL_STATE;
    } catch (e) {
      return INITIAL_STATE;
    }
  });

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateState = (updates: Partial<TayoState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const resetState = () => {
    setState(INITIAL_STATE);
  };

  return { state, updateState, resetState, isHydrated };
}
