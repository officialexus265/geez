"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { APP_VERSION, isVersionBelow } from "@/lib/version";
import { Download, RefreshCw, ShieldAlert } from "lucide-react";

type UpdateConfig = {
  min_app_version: string | null;
  apk_download_url: string | null;
  force_update_message: string | null;
  force_update_enabled: boolean;
};

export function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const [blocking, setBlocking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(APP_VERSION);
  const [config, setConfig] = useState<UpdateConfig | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        let version = APP_VERSION;
        try {
          const { Capacitor } = await import("@capacitor/core");
          if (Capacitor.isNativePlatform()) {
            const { App } = await import("@capacitor/app");
            const info = await App.getInfo();
            if (info?.version) version = info.version;
          }
        } catch {
          // web or plugin missing — use APP_VERSION
        }

        if (cancelled) return;
        setCurrentVersion(version);

        const supabase = createClient();
        const { data } = await supabase
          .from("app_settings")
          .select(
            "min_app_version, apk_download_url, force_update_message, force_update_enabled"
          )
          .eq("id", "main")
          .maybeSingle();

        if (cancelled) return;

        const cfg: UpdateConfig = {
          min_app_version: (data as any)?.min_app_version ?? null,
          apk_download_url: (data as any)?.apk_download_url ?? null,
          force_update_message: (data as any)?.force_update_message ?? null,
          force_update_enabled: !!(data as any)?.force_update_enabled,
        };
        setConfig(cfg);

        if (
          cfg.force_update_enabled &&
          cfg.min_app_version &&
          isVersionBelow(version, cfg.min_app_version)
        ) {
          setBlocking(true);
        }
      } catch (e) {
        console.error("Force update check failed", e);
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (blocking && config) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Update required</h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          {config.force_update_message ||
            "A new version of GEEZ is required to continue. Please install the latest app."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Your version: <strong>{currentVersion}</strong>
          {config.min_app_version && (
            <>
              {" "}
              · Required: <strong>{config.min_app_version}</strong>
            </>
          )}
        </p>

        {config.apk_download_url ? (
          <a
            href={config.apk_download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg"
          >
            <Download className="h-4 w-4" />
            Download update
          </a>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Ask your partner for the latest APK file.
          </p>
        )}

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 text-sm text-primary hover:underline"
        >
          I already updated — check again
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
