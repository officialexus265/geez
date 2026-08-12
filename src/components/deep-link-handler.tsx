"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Listens for geez:// deep links when running inside the Capacitor APK.
 * After PayChangu, Android opens geez://deposit/return?tx_ref=...
 * and we navigate inside the app.
 */
export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    let remove: (() => void) | undefined;

    async function setup() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");

        // Cold start: app opened by a link
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
          handleUrl(launch.url);
        }

        // Warm start: app already open
        const handle = await App.addListener("appUrlOpen", (event) => {
          handleUrl(event.url);
        });
        remove = () => handle.remove();
      } catch {
        // Not in Capacitor or plugin missing — ignore
      }
    }

    function handleUrl(url: string) {
      try {
        // geez://deposit/return?tx_ref=XXX
        // or https://geez-lac.vercel.app/deposit/return?tx_ref=XXX
        const parsed = new URL(url.replace(/^geez:\//, "https://geez.app/"));
        const path = parsed.pathname || "";
        const txRef = parsed.searchParams.get("tx_ref");

        if (path.includes("deposit/return") || url.includes("deposit/return")) {
          const target = txRef
            ? `/deposit/return?tx_ref=${encodeURIComponent(txRef)}`
            : "/deposit/return";
          router.push(target);
        }
      } catch (e) {
        console.error("Deep link parse error", e);
      }
    }

    setup();
    return () => {
      remove?.();
    };
  }, [router]);

  return null;
}
