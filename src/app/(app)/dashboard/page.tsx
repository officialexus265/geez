"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Target,
  Heart,
  Plus,
  Loader2,
} from "lucide-react";
import { formatMWK, formatDate } from "@/lib/utils";
import { useHideBalance } from "@/hooks/use-hide-balance";
import { createClient } from "@/lib/supabase/client";

interface Summary {
  total: number;
  yours: number;
  partner: number;
}

interface RecentTx {
  id: string;
  amount: number;
  depositor_name: string;
  status: string;
  created_at: string;
  note: string | null;
}

interface GoalPreview {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  emoji: string | null;
}

export default function DashboardPage() {
  const { hidden } = useHideBalance();
  const [summary, setSummary] = useState<Summary>({ total: 0, yours: 0, partner: 0 });
  const [recent, setRecent] = useState<RecentTx[]>([]);
  const [goals, setGoals] = useState<GoalPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let userId: string | null = null;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    async function refreshMoney() {
      if (!userId) return;
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, amount, depositor_id, depositor_name, status, created_at, note")
        .eq("status", "success")
        .order("created_at", { ascending: false });

      if (txs) {
        const total = txs.reduce((s, t) => s + Number(t.amount), 0);
        const yours = txs
          .filter((t) => t.depositor_id === userId)
          .reduce((s, t) => s + Number(t.amount), 0);
        setSummary({ total, yours, partner: total - yours });
        setRecent(txs.slice(0, 5));
      }
    }

    async function refreshGoals() {
      const { data: goalsData } = await supabase
        .from("goals")
        .select("id, title, target_amount, current_amount, emoji")
        .eq("is_completed", false)
        .order("created_at", { ascending: false })
        .limit(3);
      if (goalsData) setGoals(goalsData);
    }

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }
        userId = user.id;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (profile) setUserName(profile.full_name);

        await refreshMoney();
        await refreshGoals();

        // Live updates when partner deposits or status changes
        const txChannel = supabase
          .channel("dashboard-transactions")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "transactions" },
            () => {
              refreshMoney();
            }
          )
          .subscribe();
        channels.push(txChannel);

        const goalsChannel = supabase
          .channel("dashboard-goals")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "goals" },
            () => {
              refreshGoals();
            }
          )
          .subscribe();
        channels.push(goalsChannel);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      {userName && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted-foreground"
        >
          Welcome back, <span className="font-medium text-foreground">{userName.split(" ")[0]}</span>
        </motion.p>
      )}

      {/* Hero Balance Card */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-hover p-6 text-primary-foreground shadow-xl"
      >
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-black/10 blur-2xl" />

        <div className="relative">
          <p className="text-sm font-medium opacity-90">Total Contributed</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight">
            {hidden ? "••••••" : formatMWK(summary.total)}
          </h1>

          <div className="mt-6 flex gap-3">
            <Link
              href="/deposit"
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/20 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/30"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Deposit
            </Link>
            <Link
              href="/withdraw"
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-black/20 py-3 text-sm font-semibold backdrop-blur transition hover:bg-black/30"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Withdraw
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Contribution split */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">You</p>
          <p className="mt-1 text-xl font-bold">{hidden ? "••••" : formatMWK(summary.yours)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Partner</p>
          <p className="mt-1 text-xl font-bold">{hidden ? "••••" : formatMWK(summary.partner)}</p>
        </div>
      </motion.section>

      {/* Goals Preview */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.16 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Target className="h-4 w-4 text-primary" />
            Goals
          </h2>
          <Link href="/goals" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        {goals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No goals yet. Create your first one!</p>
            <Link href="/goals" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Add a goal
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => {
              const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
              return (
                <Link
                  key={g.id}
                  href="/goals"
                  className="block rounded-2xl border border-border bg-card p-4 transition hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{g.emoji || "🎯"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium">{g.title}</p>
                        <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* Recent Activity */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.24 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            Recent activity
          </h2>
          <Link href="/history" className="text-sm font-medium text-primary hover:underline">
            See all
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Heart className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No transactions yet. Make your first deposit!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
                  <ArrowDownToLine className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tx.depositor_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(tx.created_at)}
                    {tx.note ? ` · ${tx.note}` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold text-success">
                  {hidden ? "+•••" : `+${formatMWK(Number(tx.amount))}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
