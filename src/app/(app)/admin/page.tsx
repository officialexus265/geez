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
  const [debug, setDebug] = useState<string>("");
  const [stats, setStats] = useState({
    users: 0,
    dualPairs: 0,
    totalDeposits: 0,
    pendingTx: 0,
    totalFees: 0,
  });

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/admin/me").then((r) => r.json());
        setDebug(JSON.stringify(me));

        if (!me.allowed) {
          setAllowed(false);
          setLoading(false);
          return;
        }
        setAllowed(true);

        const supabase = createClient();
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

        let totalFees = 0;
        try {
          const { data: fees } = await supabase.from("fee_ledger").select("amount");
          totalFees = (fees || []).reduce(
            (s: number, f: { amount: number }) => s + Number(f.amount),
            0
          );
        } catch {
          /* ignore */
        }

        setStats({
          users: users || 0,
          dualPairs: pairs || 0,
          totalDeposits,
          pendingTx: pendingTx || 0,
          totalFees,
        });
      } catch (e) {
        console.error(e);
        setDebug(String(e));
        setAllowed(false);
      } finally {
        setLoading(false);
      }
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
        <p className="mt-2 break-all text-left text-[11px] text-muted-foreground">
          Debug: {debug || "no data"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Must be signed in as officialnexus265@gmail.com or have role
          super_admin / admin.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-primary"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const cards = [
    { label: "Users", value: String(stats.users), icon: Users },
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
          Platform overview
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

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/settings" className="text-primary hover:underline">
          Settings & branding
        </Link>
        <Link href="/dashboard" className="text-primary hover:underline">
          User dashboard
        </Link>
      </div>
    </div>
  );
}
