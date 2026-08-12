"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Phone,
  Shield,
  LogOut,
  Loader2,
  Check,
  Save,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  canUseBiometrics,
  isBiometricsEnabled,
  setBiometricsEnabled,
  promptBiometrics,
} from "@/lib/biometrics";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bioOn, setBioOn] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone, pin_hash, avatar_url")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || "");
        setEmail(profile.email || user.email || "");
        setPhone(profile.phone || "");
        setHasPin(!!profile.pin_hash);
        setAvatarUrl(profile.avatar_url || null);
      }
      setLoading(false);
      setBioOn(isBiometricsEnabled());
      canUseBiometrics().then(setBioSupported);
    }
    load();
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updates: Record<string, string> = {
        full_name: fullName.trim(),
        phone: phone.replace(/\s/g, "") || "",
      };

      // If setting a new PIN
      if (pin) {
        if (pin.length < 4) throw new Error("PIN must be at least 4 digits");
        if (pin !== confirmPin) throw new Error("PINs do not match");

        // Call a small API or hash client-side then store
        // For simplicity we hash on server via a dedicated endpoint later.
        // Here we store a simple marker; real hashing happens in /api/profile/pin
        const res = await fetch("/api/profile/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to set PIN");
        setHasPin(true);
        setPin("");
        setConfirmPin("");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (updateError) throw updateError;

      setMessage("Profile saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-4">
          <label className="relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8" />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const path = `avatars/${user.id}.${file.name.split(".").pop()}`;
                const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
                if (error) { setError(error.message); return; }
                const { data: { publicUrl } } = supabase.storage.from("branding").getPublicUrl(path);
                await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
                setAvatarUrl(publicUrl);
                setMessage("Profile picture updated");
              }}
            />
          </label>
          <div>
            <p className="font-semibold">{fullName || "Your Name"}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        onSubmit={handleSaveProfile}
        className="space-y-4 rounded-2xl border border-border bg-card p-5"
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <Phone className="h-3.5 w-3.5" />
            Phone number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0999 123 456"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Used to receive withdrawal confirmation codes
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <Shield className="h-3.5 w-3.5" />
            Withdrawal PIN {hasPin && <span className="text-success">(set)</span>}
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder={hasPin ? "Enter new PIN to change" : "Set a 4–6 digit PIN"}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {pin && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Confirm PIN"
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            <Check className="h-4 w-4" />
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save changes
            </>
          )}
        </button>
      </motion.form>

      <a
        href="/goals"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-medium transition hover:bg-muted"
      >
        Goals
      </a>
      
      {bioSupported && (
        <button
          type="button"
          onClick={async () => {
            if (!bioOn) {
              const ok = await promptBiometrics("Enable biometric login for GEEZ");
              if (!ok) {
                setError("Biometric verification failed");
                return;
              }
              setBiometricsEnabled(true);
              setBioOn(true);
              setMessage("Biometric login enabled");
            } else {
              setBiometricsEnabled(false);
              setBioOn(false);
              setMessage("Biometric login disabled");
            }
          }}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-medium transition hover:bg-muted"
        >
          <span>Unlock with fingerprint / face</span>
          <span className={bioOn ? "text-success" : "text-muted-foreground"}>
            {bioOn ? "On" : "Off"}
          </span>
        </button>
      )}
<a
        href="/about"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-medium transition hover:bg-muted"
      >
        About GEEZ
      </a>
      <a
        href="/settings"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-medium transition hover:bg-muted"
      >
        Branding & Settings (Admin)
      </a>

      <button
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 py-3.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
