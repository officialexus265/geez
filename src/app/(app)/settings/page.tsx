"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, Upload, Loader2, Check, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
  const [appIconUrl, setAppIconUrl] = useState<string | null>(null);
  const [splashUrl, setSplashUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.role === "admin");

      const { data: settings } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", "main")
        .single();

      if (settings) {
        setLogoUrl(settings.logo_url);
        setFaviconUrl(settings.favicon_url);
        setOgImageUrl(settings.og_image_url);
        // extra fields stored in a flexible way if present
        setAppIconUrl((settings as any).app_icon_url || null);
        setSplashUrl((settings as any).splash_url || null);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function uploadFile(
    file: File,
    folder: string
  ): Promise<string | null> {
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: true });

    if (error) {
      console.error(error);
      throw new Error(error.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("branding").getPublicUrl(path);

    return publicUrl;
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "favicon" | "og" | "app_icon" | "splash"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const url = await uploadFile(file, type);
      if (!url) throw new Error("Upload failed");

      const updates: Record<string, string> = {};
      if (type === "logo") {
        setLogoUrl(url);
        updates.logo_url = url;
      }
      if (type === "favicon") {
        setFaviconUrl(url);
        updates.favicon_url = url;
      }
      if (type === "og") {
        setOgImageUrl(url);
        updates.og_image_url = url;
      }
      if (type === "app_icon") {
        setAppIconUrl(url);
        updates.app_icon_url = url;
      }
      if (type === "splash") {
        setSplashUrl(url);
        updates.splash_url = url;
      }

      const supabase = createClient();
      await supabase.from("app_settings").update(updates).eq("id", "main");

      setMessage("Uploaded successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Admin access required
      </div>
    );
  }

  const fields = [
    { key: "logo" as const, label: "App Logo", url: logoUrl, hint: "Main logo shown in the app" },
    { key: "favicon" as const, label: "Favicon", url: faviconUrl, hint: "Browser tab icon" },
    { key: "og" as const, label: "OG Image", url: ogImageUrl, hint: "Social share preview image" },
    { key: "app_icon" as const, label: "App Icon (PWA / APK)", url: appIconUrl, hint: "Icon shown on home screen after install (512×512 PNG recommended)" },
    { key: "splash" as const, label: "Splash / Opening Screen", url: splashUrl, hint: "Shown when the app first opens" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings className="h-6 w-6" />
          Branding
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload logo, icons and splash screen
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
          <Check className="h-4 w-4" />
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {fields.map((f) => (
          <motion.div
            key={f.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
                {f.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.label} className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{f.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{f.hint}</p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
                  <Upload className="h-3.5 w-3.5" />
                  {saving ? "Uploading…" : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={saving}
                    onChange={(e) => handleUpload(e, f.key)}
                  />
                </label>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Create a public storage bucket named <code className="rounded bg-muted px-1">branding</code> in Supabase
        and make it public for these uploads to work.
      </p>
    </div>
  );
}
