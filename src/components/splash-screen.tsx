"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Full-screen splash shown on first load.
 * Uses the image uploaded in Admin Settings → Splash.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Only show once per session
    try {
      if (sessionStorage.getItem("geez-splash-shown") === "1") {
        setVisible(false);
        return;
      }
    } catch {}

    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("app_settings")
          .select("splash_url, logo_url")
          .eq("id", "main")
          .single();
        setUrl(data?.splash_url || data?.logo_url || null);
      } catch {
        setUrl(null);
      } finally {
        setReady(true);
      }
    }
    load();

    const t = setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem("geez-splash-shown", "1");
      } catch {}
    }, 2200);

    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#121416]"
      style={{
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay so text/logo stays readable if needed */}
      <div className="absolute inset-0 bg-black/20" />
      {!url && ready && (
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#9b2335] text-white shadow-2xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-10 w-10"
            >
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
          </div>
          <p className="text-xl font-bold tracking-tight text-white">GEEZ</p>
        </div>
      )}
    </div>
  );
}
