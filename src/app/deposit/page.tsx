"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  Loader2,
  Heart,
  ChevronDown,
} from "lucide-react";
import { formatMWK } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

// These will later come from Supabase profiles
const DEPOSITORS = [
  { id: "you", name: "You" },
  { id: "partner", name: "Partner" },
];

export default function PublicDepositPage() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [depositor, setDepositor] = useState(DEPOSITORS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const num = Number(amount);
    if (!num || num < 100) {
      setError("Minimum deposit is MWK 100");
      return;
    }

    setLoading(true);

    try {
      const selected = DEPOSITORS.find((d) => d.id === depositor);
      const res = await fetch("/api/paychangu/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          note: note || undefined,
          depositor_name: selected?.name || "Unknown",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate payment");
      }

      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
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
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <span className="text-xl font-bold">GEEZ</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Public Deposit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contribute to our shared savings
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
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="mb-1.5 block text-sm font-medium">
              Who is depositing?
            </label>
            <div className="relative">
              <select
                value={depositor}
                onChange={(e) => setDepositor(e.target.value)}
                className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-3 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {DEPOSITORS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
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

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
