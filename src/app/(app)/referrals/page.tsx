"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift, Copy, Check, Loader2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMWK, formatDate } from "@/lib/utils";

type Earning = {
  id: string;
  deposit_amount: number;
  earning_amount: number;
  deposit_tx_ref: string | null;
  created_at: string;
  referred_id: string;
};

export default function ReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [balance, setBalance] = useState(0);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_username, referral_balance")
      .eq("id", user.id)
      .single();

    setUsername(profile?.referral_username || "");
    setEditName(profile?.referral_username || "");
    setBalance(Number(profile?.referral_balance || 0));

    const { data: rows } = await supabase
      .from("referral_earnings")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    setEarnings((rows as Earning[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/register?ref=${encodeURIComponent(username)}`
      : "";

  function copy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const name = editName.trim().toLowerCase().replace(/\s/g, "");
      if (!name || name.length < 3) {
        throw new Error("Username must be at least 3 characters");
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("referral_username", name)
        .neq("id", user.id)
        .maybeSingle();
      if (taken) throw new Error("Username already taken");

      const { error: upErr } = await supabase
        .from("profiles")
        .update({ referral_username: name })
        .eq("id", user.id);
      if (upErr) throw upErr;
      setUsername(name);
      setMessage("Referral username saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
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

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Gift className="h-6 w-6 text-primary" />
          Referrals
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earn <strong>1%</strong> of each friend’s <strong>first</strong>{" "}
          successful deposit — paid from the platform, not from their deposit.
        </p>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-hover p-6 text-primary-foreground shadow-lg">
        <p className="text-sm opacity-90">Referral wallet</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">
          {formatMWK(balance)}
        </p>
        <p className="mt-2 text-xs opacity-80">
          {earnings.length} successful referral
          {earnings.length === 1 ? "" : "s"}
        </p>
      </div>

      <form onSubmit={saveUsername} className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Your referral username</h2>
        <input
          value={editName}
          onChange={(e) =>
            setEditName(e.target.value.toLowerCase().replace(/\s/g, ""))
          }
          placeholder="e.g. giftk"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save username"}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-success">{message}</p>}
      </form>

      {username && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-medium">Share link</p>
          <p className="break-all text-xs text-muted-foreground">{shareUrl}</p>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy invite link"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" />
          Earnings history
        </h2>
        {earnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No referral earnings yet. Share your link to get started.
          </p>
        ) : (
          earnings.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
            >
              <div>
                <p className="text-sm font-medium">
                  +{formatMWK(Number(e.earning_amount))}
                </p>
                <p className="text-xs text-muted-foreground">
                  1% of {formatMWK(Number(e.deposit_amount))} ·{" "}
                  {formatDate(e.created_at)}
                </p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
