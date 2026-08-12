"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Upload,
  Loader2,
  Check,
  ImageIcon,
  RotateCcw,
  Shield,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

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

      const admin = profile?.role === "admin";
      setIsAdmin(admin);

      if (admin) {
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .order("created_at");
        setProfiles(allProfiles || []);
      }

      const { data: settings } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", "main")
        .single();

      if (settings) {
        setLogoUrl(settings.logo_url);
        setFaviconUrl(settings.favicon_url);
        setOgImageUrl(settings.og_image_url);
        setAppIconUrl((settings as any).app_icon_url || null);
        setSplashUrl((settings as any).splash_url || null);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function uploadFile(file: File, folder: string): Promise<string | null> {
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: true });

    if (error) throw new Error(error.message);

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

  async function setRole(userId: string, role: "admin" | "member") {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);
      if (error) throw error;
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role } : p))
      );
      setMessage(`Role updated to ${role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setSaving(false);
    }
  }

  async function resetArea(area: "transactions" | "withdrawals" | "goals" | "notifications" | "all") {
    const labels: Record<string, string> = {
      transactions: "all deposits",
      withdrawals: "all withdrawals",
      goals: "all goals",
      notifications: "all notifications",
      all: "EVERYTHING (deposits, withdrawals, goals, notifications)",
    };
    if (
      !confirm(
        `Are you sure you want to permanently delete ${labels[area]}?\n\nThis cannot be undone.`
      )
    ) {
      return;
    }
    if (area === "all" && !confirm("Final confirmation: wipe the entire savings history?")) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      if (area === "transactions" || area === "all") {
        await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      if (area === "withdrawals" || area === "all") {
        await supabase.from("withdrawals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      if (area === "goals" || area === "all") {
        await supabase.from("goals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      if (area === "notifications" || area === "all") {
        await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      setMessage(`Reset complete: ${labels[area]}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed — check RLS policies");
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
    { key: "logo" as const, label: "App Logo", url: logoUrl, hint: "Shown in the top bar" },
    { key: "favicon" as const, label: "Favicon", url: faviconUrl, hint: "Browser tab icon" },
    { key: "og" as const, label: "OG Image", url: ogImageUrl, hint: "Social share preview" },
    { key: "app_icon" as const, label: "App Icon (PWA / APK)", url: appIconUrl, hint: "Home screen icon (512×512 PNG)" },
    { key: "splash" as const, label: "Splash / Opening Screen", url: splashUrl, hint: "Shown when app opens" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings className="h-6 w-6" />
          Admin Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Branding, roles & reset
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

      {/* Roles */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-primary" />
          Account roles
        </h2>
        <div className="space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
              <select
                value={p.role}
                onChange={(e) =>
                  setRole(p.id, e.target.value as "admin" | "member")
                }
                disabled={saving}
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Branding */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ImageIcon className="h-4 w-4 text-primary" />
          Branding
        </h2>
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
        <p className="text-xs text-muted-foreground">
          Storage bucket <code className="rounded bg-muted px-1">branding</code> must be public.
        </p>
      </section>

      
      {/* Partner recovery */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Shield className="h-4 w-4 text-primary" />
          Partner account recovery
        </h2>
        <p className="text-sm text-muted-foreground">
          If your partner lost their password, send them a reset link.
        </p>
        <div className="space-y-2">
          {profiles
            .filter((p) => p.id)
            .map((p) => (
              <button
                key={p.id}
                disabled={saving}
                onClick={async () => {
                  if (!confirm(`Send password reset email to ${p.email}?`)) return;
                  setSaving(true);
                  setError(null);
                  setMessage(null);
                  try {
                    const res = await fetch("/api/admin/reset-partner", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ partner_email: p.email }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed");
                    setMessage(`Reset email sent to ${p.email}`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <span>
                  <span className="font-medium">{p.full_name}</span>
                  <span className="ml-2 text-muted-foreground">{p.email}</span>
                </span>
                <span className="text-xs font-medium text-primary">Send reset</span>
              </button>
            ))}
        </div>
      </section>

      {/* Reset */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-destructive">
          <RotateCcw className="h-4 w-4" />
          Reset data
        </h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete data. Use when you want a fresh start after clearing the balance.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => resetArea("transactions")}
            disabled={saving}
            className="rounded-2xl border border-border bg-card py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Reset deposits
          </button>
          <button
            onClick={() => resetArea("withdrawals")}
            disabled={saving}
            className="rounded-2xl border border-border bg-card py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Reset withdrawals
          </button>
          <button
            onClick={() => resetArea("goals")}
            disabled={saving}
            className="rounded-2xl border border-border bg-card py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Reset goals
          </button>
          <button
            onClick={() => resetArea("notifications")}
            disabled={saving}
            className="rounded-2xl border border-border bg-card py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Reset notifications
          </button>
        </div>
        <button
          onClick={() => resetArea("all")}
          disabled={saving}
          className="w-full rounded-2xl border border-destructive/40 bg-destructive/10 py-3.5 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          Reset entire app (full wipe)
        </button>
      </section>
    </div>
  );
}
