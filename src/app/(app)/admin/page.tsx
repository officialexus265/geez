"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMWK } from "@/lib/utils";
import { Loader2, Shield, Users, Wallet, Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [stats, setStats] = useState({
    users: 0,
    dualPairs: 0,
    totalDeposits: 0,
    pendingTx: 0,
    totalFees: 0,
  });

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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Admin profile load error:", profileError);
      }

      const role = (profile?.role || "member").trim().toLowerCase();
      const allowedRoles = ["super_admin", "admin", "finance"];
      if (!allowedRoles.includes(role)) {
        console.log("Admin denied. role=", JSON.stringify(role), "email=", profile?.email);
        setAllowed(false);
        setLoading(false);
        return;
      }
      setAllowed(true);

      const [{ count: users }, { count: pairs }, { data: txs }] =
        await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase
            .from("dual_pairs")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("transactions")
            .select("amount, status")
            .eq("status", "success"),
        ]);

      const totalDeposits = (txs || []).reduce(
        (s, t) => s + Number(t.amount),
        0
      );

      const { count: pendingTx } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      setStats({
        users: users || 0,
        dualPairs: pairs || 0,
        totalDeposits,
        pendingTx: pendingTx || 0,
        totalFees: 0,
      });

      const { data: fees } = await supabase.from("fee_ledger").select("amount");
      const totalFees = (fees || []).reduce((s: number, f: any) => s + Number(f.amount), 0);
      setStats((prev) => ({ ...prev, totalFees }));
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-medium">Admin access required</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const cards = [
    {
      label: "Users",
      value: String(stats.users),
      icon: Users,
    },
    {
      label: "Active dual pairs",
      value: String(stats.dualPairs),
      icon: Users,
    },
    {
      label: "Client deposits (success)",
      value: formatMWK(stats.totalDeposits),
      icon: Wallet,
    },
    {
      label: "Pending transactions",
      value: String(stats.pendingTx),
      icon: Landmark,
    },
    {
      label: "Platform fees collected",
      value: formatMWK(stats.totalFees),
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="h-6 w-6 text-primary" />
          Admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform overview — Phase 1 foundation
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <c.icon className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                {c.label}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">PayChangu merchant balance</p>
        <p className="mt-1">
          Live wallet readout can be wired when PayChangu balance API access is
          available. Client deposit total above is from GEEZ transaction records.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/settings" className="text-primary hover:underline">
          Settings & force update
        </Link>
        <Link href="/dashboard" className="text-primary hover:underline">
          User dashboard
        </Link>
      </div>
    </div>
  );
}
