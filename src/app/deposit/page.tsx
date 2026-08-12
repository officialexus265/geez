"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  Loader2,
  Heart,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { formatMWK } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/platform";

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

interface ProfileOption {
  id: string;
  full_name: string;
}

interface GoalOption {
  id: string;
  title: string;
  emoji: string | null;
}

export default function DepositPage() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Auth / profiles
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    full_name: string;
    email: string;
  } | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedDepositorId, setSelectedDepositorId] = useState<string>("");

  // Goals
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>(""); // "" = General

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Load all profiles (for public mode)
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("created_at", { ascending: true });

      if (allProfiles) {
        setProfiles(allProfiles);
      }

      // Load goals
      const { data: allGoals } = await supabase
        .from("goals")
        .select("id, title, emoji")
        .eq("is_completed", false)
        .order("created_at", { ascending: false });

      if (allGoals) {
        setGoals(allGoals);
      }

      if (user) {
        setIsLoggedIn(true);
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", user.id)
          .single();

        if (profile) {
          setCurrentUser({
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
          });
          setSelectedDepositorId(profile.id);
        }
      } else if (allProfiles && allProfiles.length > 0) {
        setSelectedDepositorId(allProfiles[0].id);
      }

      setPageLoading(false);
    }

    load();
  }, []);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const num = Number(amount);
    if (!num || num < 100) {
      setError("Minimum deposit is MWK 100");
      return;
    }

    let depositor_name = "Unknown";
    let depositor_id: string | null = null;
    let email: string | undefined;

    if (isLoggedIn && currentUser) {
      // Logged in → always use the current user
      depositor_name = currentUser.full_name;
      depositor_id = currentUser.id;
      email = currentUser.email;
    } else {
      // Public contribution → use the selected profile
      const selected = profiles.find((p) => p.id === selectedDepositorId);
      if (!selected) {
        setError("Please select who is contributing");
        return;
      }
      depositor_name = selected.full_name;
      depositor_id = selected.id;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/paychangu/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          note: note || undefined,
          depositor_name,
          depositor_id,
          email,
          goal_id: selectedGoalId || null,
          platform: isNativeApp() ? "native" : "web",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate payment");
      }

      // Redirect to PayChangu checkout
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 left-4 z-20">
        <Link
          href="/dashboard"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-love/10 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-md px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <Link href={isLoggedIn ? "/dashboard" : "/"} className="inline-flex items-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <span className="text-xl font-bold">GEEZ</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {isLoggedIn ? "Make a Deposit" : "Public Contribution"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoggedIn
              ? "Add money to your shared savings"
              : "Contribute to our shared savings"}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleDeposit}
          className="space-y-5"
        >
          {/* Who is depositing */}
          {isLoggedIn && currentUser ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <label className="mb-1.5 block text-sm font-medium">
                Contributing as
              </label>
              <div className="rounded-xl bg-muted/50 px-3 py-3 text-sm font-medium">
                {currentUser.full_name}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4">
              <label className="mb-1.5 block text-sm font-medium">
                Who is contributing?
              </label>
              <div className="relative">
                <select
                  value={selectedDepositorId}
                  onChange={(e) => setSelectedDepositorId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-3 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {profiles.length === 0 && (
                    <option value="">No users found</option>
                  )}
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Goal selection */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="mb-1.5 block text-sm font-medium">
              Contribute to
            </label>
            <div className="relative">
              <select
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-3 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">General savings (no specific goal)</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.emoji ? `${g.emoji} ` : ""}
                    {g.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Amount */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Amount (MWK)
            </label>
            <div className="relative">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
                MWK
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent py-2 pl-16 text-4xl font-bold outline-none placeholder:text-muted-foreground/40"
                required
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((qa) => (
                <button
                  key={qa}
                  type="button"
                  onClick={() => setAmount(String(qa))}
                  className="rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary"
                >
                  {formatMWK(qa)}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="mb-1.5 block text-sm font-medium">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Birthday contribution…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              maxLength={100}
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !amount}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-5 w-5" />
                Continue to PayChangu
              </>
            )}
          </button>
        </motion.form>

        {!isLoggedIn && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
