"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownToLine, Loader2, Heart } from "lucide-react";
import { formatMWK } from "@/lib/utils";

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

export default function DepositPage() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In real version this will come from auth + profiles
  const depositorName = "You";

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
      const res = await fetch("/api/paychangu/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          note: note || undefined,
          depositor_name: depositorName,
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

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold tracking-tight">Deposit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add money to your shared savings vault
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        onSubmit={handleDeposit}
        className="space-y-5"
      >
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
            placeholder="e.g. For our trip…"
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
              Preparing payment…
            </>
          ) : (
            <>
              <ArrowDownToLine className="h-5 w-5" />
              Continue to PayChangu
            </>
          )}
        </button>
      </motion.form>

      <p className="text-center text-xs text-muted-foreground">
        <Heart className="inline h-3 w-3 fill-love text-love" /> Secure payment via
        Airtel Money, TNM Mpamba, Bank or Card
      </p>
    </div>
  );
}
