import { useState, useEffect, useRef, useCallback } from "react";
import type { DimensionData, ChatMessage } from "@workspace/api-client-react";

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

function readFromStorage(): TayoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as TayoState) : INITIAL_STATE;
  } catch {
    return INITIAL_STATE;
  }
}

function writeToStorage(state: TayoState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private-browsing errors
  }
}

export function useTayoState() {
  const [state, setState] = useState<TayoState>(readFromStorage);
  const [isHydrated, setIsHydrated] = useState(false);

  // Keep a ref that is always up-to-date with the latest state so that
  // updateState can merge against it synchronously — without waiting for
  // React's batched setState callback to be invoked.
  const stateRef = useRef(state);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Keep the ref in sync whenever React actually commits the state.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * Merge updates into state.  localStorage is written *synchronously* before
   * setState is called so that any navigation triggered immediately after this
   * call will find the fresh value in storage.
   */
  const updateState = useCallback((updates: Partial<TayoState>) => {
    const next = { ...stateRef.current, ...updates };
    stateRef.current = next;           // update ref immediately
    writeToStorage(next);              // persist immediately, before re-render
    console.log("[tayo] updateState →", Object.keys(updates), next);
    setState(next);
  }, []);

  const resetState = useCallback(() => {
    stateRef.current = INITIAL_STATE;
    writeToStorage(INITIAL_STATE);
    setState(INITIAL_STATE);
  }, []);

  return { state, updateState, resetState, isHydrated };
}
