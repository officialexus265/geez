"use client";

import { useEffect } from "react";

/**
 * Unregisters old service workers and clears Cache Storage once.
 * Stops Capacitor/WebView from showing a previous landing page forever.
 */
export function ClearStaleCache() {
  useEffect(() => {
    async function run() {
      try {
        if (typeof window === "undefined") return;

        const KEY = "geez_sw_cleared_v2";
        // Always try unregister; only skip full cache wipe if already done this install
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }

        // Mark so we don't loop; still unregisters every visit above
        try {
          localStorage.setItem(KEY, "1");
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    }
    run();
  }, []);

  return null;
}
