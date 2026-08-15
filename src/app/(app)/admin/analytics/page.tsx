"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMWK } from "@/lib/utils";
import {
  Loader2,
  BarChart3,
  Users,
  Wallet,
  Landmark,
  Gift,
  Target,
} from "lucide-react";
import Link from "next/link";

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [s, setS] = useState({
    users: 0,
    members: 0,
    dualActive: 0,
    depositsSuccess: 0,
    depositsPending: 0,
    depositVolume: 0,
    fees: 0,
    loansActive: 0,
    loansVolume: 0,
    goals: 0,
    fixedGoals: 0,
    referralsPaid: 0,
    withdrawals: 0,
  });

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/admin/me").then((r) => r.json());
      if (!me.allowed) {
        setAllowed(false);
        setLoading(false);
        return;
      }
      setAllowed(true);
      const supabase = createClient();

      const [
        { count: users },
        { data: profiles },
        { count: dualActive },
        { data: txs },
        { count: pending },
        { data: fees },
        { data: loans },
        { data: goals },
        { data: refs },
        { count: withdrawals },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("role"),
        supabase
          .from("dual_pairs")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase.from("transactions").select("amount, status"),
        supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("fee_ledger").select("amount"),
        supabase.from("loans").select("principal, status"),
        supabase.from("goals").select("goal_type"),
        supabase.from("referral_earnings").select("earning_amount"),
        supabase.from("withdrawals").select("*", { count: "exact", head: true }),
      ]);

      const members = (profiles || []).filter((p) => {
        const r = String(p.role || "member").toLowerCase();
        return !["super_admin", "admin", "finance", "support", "ops"].includes(r);
      }).length;

      const success = (txs || []).filter((t) => t.status === "success");
      const depositVolume = success.reduce((a, t) => a + Number(t.amount), 0);
      const feeTotal = (fees || []).reduce((a, f) => a + Number(f.amount), 0);
      const activeLoans = (loans || []).filter((l) => l.status === "active");
      const loansVolume = activeLoans.reduce((a, l) => a + Number(l.principal), 0);
      const fixedGoals = (goals || []).filter((g) => g.goal_type === "fixed").length;
      const referralsPaid = (refs || []).reduce(
        (a, r) => a + Number(r.earning_amount),
        0
      );

      setS({
        users: users || 0,
        members,
        dualActive: dualActive || 0,
        depositsSuccess: success.length,
        depositsPending: pending || 0,
        depositVolume,
        fees: feeTotal,
        loansActive: activeLoans.length,
        loansVolume,
        goals: (goals || []).length,
        fixedGoals,
        referralsPaid,
        withdrawals: withdrawals || 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!allowed) {
    return <p className="text-center text-muted-foreground">Admin only</p>;
  }

  const cards = [
    { label: "Total users", value: String(s.users), icon: Users },
    { label: "Members", value: String(s.members), icon: Users },
    { label: "Active dual pairs", value: String(s.dualActive), icon: Users },
    { label: "Successful deposits", value: String(s.depositsSuccess), icon: Wallet },
    { label: "Pending deposits", value: String(s.depositsPending), icon: Wallet },
    { label: "Deposit volume", value: formatMWK(s.depositVolume), icon: Wallet },
    { label: "Platform fees", value: formatMWK(s.fees), icon: BarChart3 },
    { label: "Active loans", value: String(s.loansActive), icon: Landmark },
    { label: "Active loan principal", value: formatMWK(s.loansVolume), icon: Landmark },
    { label: "Goals", value: String(s.goals), icon: Target },
    { label: "Fixed goals", value: String(s.fixedGoals), icon: Target },
    { label: "Referral payouts", value: formatMWK(s.referralsPaid), icon: Gift },
    { label: "Withdrawals (all)", value: String(s.withdrawals), icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground">Platform snapshot</p>
        </div>
        <Link href="/admin" className="text-sm text-primary">
          ← Admin home
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <c.icon className="h-3.5 w-3.5" />
              {c.label}
            </div>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
