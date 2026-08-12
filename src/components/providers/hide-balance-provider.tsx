"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const KEY = "geez-hide-balance";

type Ctx = {
  hidden: boolean;
  toggle: () => void;
  setHidden: (v: boolean) => void;
};

const HideBalanceContext = createContext<Ctx | null>(null);

export function HideBalanceProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setHiddenState(localStorage.getItem(KEY) === "1");
    } catch {}
    setReady(true);
  }, []);

  const setHidden = useCallback((v: boolean) => {
    setHiddenState(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setHiddenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ hidden, toggle, setHidden }),
    [hidden, toggle, setHidden]
  );

  // Avoid flash mismatch
  if (!ready) return <>{children}</>;

  return (
    <HideBalanceContext.Provider value={value}>
      {children}
    </HideBalanceContext.Provider>
  );
}

export function useHideBalance() {
  const ctx = useContext(HideBalanceContext);
  if (!ctx) {
    // Fallback if used outside provider
    return { hidden: false, toggle: () => {}, setHidden: () => {} };
  }
  return ctx;
}
