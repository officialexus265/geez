"use client";

import { useEffect, useState, useCallback } from "react";

const KEY = "geez-hide-balance";

export function useHideBalance() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  return { hidden, toggle };
}
