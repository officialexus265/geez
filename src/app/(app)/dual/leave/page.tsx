"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, LogOut, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DualLeavePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [pairId, setPairId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>("your partner");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("dual_pair_id")
        .eq("id", user.id)
        .single();

      if (!profile?.dual_pair_id) {
        setLoading(false);
        return;
      }
      setPairId(profile.dual_pair_id);

      const { data: pair } = await supabase
        .from("dual_pairs")
        .select("created_by, partner_id, status")
        .eq("id", profile.dual_pair_id)
        .single();

      if (pair) {
        const otherId = pair.created_by === user.id ? pair.partner_id : pair.created_by;
        if (otherId) {
          const { data: other } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", otherId)
            .single();
          if (other?.full_name) setPartnerName(other.full_name);
        }
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLeave() {
    if (!pairId) return;
    setLeaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: pair } = await supabase
        .from("dual_pairs")
        .select("*")
        .eq("id", pairId)
        .single();
      if (!pair) throw new Error("Pair not found");

      const otherId = pair.created_by === user.id ? pair.partner_id : pair.created_by;

      await supabase
        .from("dual_pairs")
        .update({
          status: "dissolved",
          dissolved_at: new Date().toISOString(),
          dissolve_requested_by: user.id,
        })
        .eq("id", pairId);

      await supabase
        .from("profiles")
        .update({ dual_pair_id: null, account_type: "personal" })
        .eq("id", user.id);

      if (otherId) {
        await supabase
          .from("profiles")
          .update({ dual_pair_id: null, account_type: "personal" })
          .eq("id", otherId);

        await supabase.from("notifications").insert({
          user_id: otherId,
          title: "Dual account ended",
          body: "Your partner has left the dual savings account. Your account is now personal.",
          type: "system",
          metadata: { pair_id: pairId },
        });
      }

      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to leave");
    } finally {
      setLeaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pairId && !done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">You are not in a dual pair.</p>
        <Link href="/dual/setup" className="text-primary text-sm font-medium">
          Set up dual savings
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center rounded-2xl border border-border bg-card p-8">
        <p className="font-semibold">You left the dual account</p>
        <p className="text-sm text-muted-foreground">
          {partnerName} has been notified. Your account is now personal.
        </p>
        <Link href="/dashboard" className="text-primary text-sm font-medium">
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <LogOut className="h-6 w-6 text-destructive" />
          Leave dual account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This ends the shared vault with {partnerName}. They will be notified.
        </p>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p>
            Shared balance and dual goals stay linked to history. New deposits will
            go to your personal account. This cannot be undone from this screen.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={leaving}
        onClick={handleLeave}
        className="w-full rounded-2xl bg-destructive py-3.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {leaving ? "Leaving…" : "Confirm leave dual account"}
      </button>

      <Link href="/dual/setup" className="block text-center text-sm text-primary">
        Cancel
      </Link>
    </div>
  );
}
