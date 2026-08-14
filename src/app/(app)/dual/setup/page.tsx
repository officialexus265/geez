"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Copy, Check, Users, QrCode } from "lucide-react";
import Link from "next/link";
import { isStaffAccount } from "@/lib/staff";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "GEEZ-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function DualSetupPage() {
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, dual_pair_id, account_type, role, email")
        .eq("id", user.id)
        .single();

      if (isStaffAccount(profile?.role, profile?.email || user.email)) {
        setError("Staff/admin accounts cannot join or create dual savings.");
        setLoading(false);
        return;
      }

      if (profile?.dual_pair_id) {
        const { data: pair } = await supabase
          .from("dual_pairs")
          .select("*")
          .eq("id", profile.dual_pair_id)
          .single();
        if (pair) {
          setCode(pair.invite_code);
          setStatus(pair.status);
          const base =
            process.env.NEXT_PUBLIC_APP_URL ||
            (typeof window !== "undefined" ? window.location.origin : "");
          setInviteUrl(`${base}/register?invite=${pair.invite_code}`);
          setLoading(false);
          return;
        }
      }

      const newCode = randomCode();
      const { data: pair, error: err } = await supabase
        .from("dual_pairs")
        .insert({
          invite_code: newCode,
          created_by: user.id,
          status: "pending",
        })
        .select()
        .single();

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      await supabase
        .from("profiles")
        .update({ dual_pair_id: pair.id, account_type: "dual" })
        .eq("id", user.id);

      setCode(pair.invite_code);
      setStatus(pair.status);
      const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      setInviteUrl(`${base}/register?invite=${pair.invite_code}`);
      setLoading(false);
    }
    init();
  }, []);

  function copy() {
    if (!inviteUrl && !code) return;
    navigator.clipboard.writeText(inviteUrl || code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <Users className="h-6 w-6 text-primary" />
          Dual savings setup
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share this code or link so your partner can join your shared vault.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Invite code
        </p>
        <p className="mt-2 font-mono text-3xl font-bold tracking-widest text-primary">
          {code}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Status:{" "}
          <span className="font-medium text-foreground">
            {status === "active" ? "Linked" : "Waiting for partner"}
          </span>
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy invite link"}
          </button>
          <p className="break-all text-[11px] text-muted-foreground">{inviteUrl}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
          <QrCode className="h-4 w-4" />
          <span className="text-xs">
            Partner can open Register and paste the code
          </span>
        </div>
      </div>

      <Link
        href="/dashboard"
        className="block text-center text-sm font-medium text-primary"
      >
        Continue to dashboard →
      </Link>
    </div>
  );
}
