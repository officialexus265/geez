"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Landmark,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { formatMWK, formatDate } from "@/lib/utils";
import Link from "next/link";

type Loan = {
  id: string;
  principal: number;
  interest_percent: number;
  interest_amount: number;
  total_repayable: number;
  amount_repaid: number;
  status: string;
  due_at: string | null;
  created_at: string;
};

export default function LoansPage() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [interest, setInterest] = useState(25);
  const [days, setDays] = useState(60);
  const [fixedTotal, setFixedTotal] = useState(0);
  const [maxBorrow, setMaxBorrow] = useState(0);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [destination, setDestination] = useState<"airtel_money" | "tnm_mpamba">(
    "airtel_money"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [repayAmounts, setRepayAmounts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Best-effort: process overdue + send due reminders
      fetch("/api/loans/process-due", { method: "POST" }).catch(() => {});
      fetch("/api/loans/reminders", { method: "POST" }).catch(() => {});
      const res = await fetch("/api/loans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setEnabled(!!data.loans_enabled);
      setInterest(data.interest_percent);
      setDays(data.duration_days);
      setFixedTotal(data.fixed_total);
      setMaxBorrow(data.max_borrowable);
      setLoans(data.loans || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function requestLoan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          phone_number: phone,
          destination_type: destination,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessage(data.message || "Loan approved");
      setAmount("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function repay(loanId: string) {
    const pay = Number(repayAmounts[loanId] || 0);
    if (!pay) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loans/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: loanId, amount: pay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Repay failed");
      setMessage(
        data.status === "repaid"
          ? "Loan fully repaid"
          : `Repayment recorded. Remaining ~ ${formatMWK(data.remaining)}`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <Landmark className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Loans</h1>
        <p className="text-muted-foreground">Coming soon</p>
        <p className="text-sm text-muted-foreground">
          The admin can enable loans in Settings. You’ll need a fixed savings
          goal with balance first.
        </p>
        <Link href="/goals" className="text-sm font-medium text-primary">
          Create a fixed goal →
        </Link>
      </div>
    );
  }

  const principal = Number(amount) || 0;
  const interestAmt = Math.round(principal * (interest / 100) * 100) / 100;
  const totalDue = principal + interestAmt;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Landmark className="h-6 w-6 text-primary" />
          Loans
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Automated approval · {interest}% flat · {days} days · only against
          fixed goals
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Fixed savings</p>
          <p className="mt-1 text-lg font-bold">{formatMWK(fixedTotal)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Max you can borrow*</p>
          <p className="mt-1 text-lg font-bold">{formatMWK(maxBorrow)}</p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        *Principal + interest on all open loans must stay within fixed goal
        balances.
      </p>

      {fixedTotal <= 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertCircle className="mb-2 h-5 w-5 text-amber-600" />
          Create a fixed savings goal and deposit money first before you can
          take a loan.{" "}
          <Link href="/goals" className="font-medium text-primary underline">
            Goals
          </Link>
        </div>
      ) : (
        <form onSubmit={requestLoan} className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Get a loan</h2>
          <input
            type="number"
            min={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (MWK)"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            required
          />
          {principal >= 100 && (
            <p className="text-xs text-muted-foreground">
              Interest {interest}%: {formatMWK(interestAmt)} · Total repay{" "}
              {formatMWK(totalDue)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDestination("airtel_money")}
              className={`rounded-xl border p-2 text-sm ${
                destination === "airtel_money"
                  ? "border-primary bg-primary/10"
                  : "border-border"
              }`}
            >
              Airtel
            </button>
            <button
              type="button"
              onClick={() => setDestination("tnm_mpamba")}
              className={`rounded-xl border p-2 text-sm ${
                destination === "tnm_mpamba"
                  ? "border-primary bg-primary/10"
                  : "border-border"
              }`}
            >
              TNM
            </button>
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Payout phone number"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Processing…" : "Request loan"}
          </button>
        </form>
      )}

      {error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          {message}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold">Your loans</h2>
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No loans yet</p>
        ) : (
          loans.map((l) => {
            const remaining =
              Number(l.total_repayable) - Number(l.amount_repaid || 0);
            return (
              <motion.div
                key={l.id}
                layout
                className="rounded-2xl border border-border bg-card p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{formatMWK(Number(l.principal))}</p>
                  <span className="text-xs capitalize text-muted-foreground flex items-center gap-1">
                    {l.status === "active" ? (
                      <Clock className="h-3 w-3" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {l.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Repay {formatMWK(Number(l.total_repayable))} · paid{" "}
                  {formatMWK(Number(l.amount_repaid || 0))} · left{" "}
                  {formatMWK(remaining)}
                  {l.due_at ? ` · due ${formatDate(l.due_at)}` : ""}
                </p>
                {l.status === "active" && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Repay amount"
                      value={repayAmounts[l.id] || ""}
                      onChange={(e) =>
                        setRepayAmounts((p) => ({
                          ...p,
                          [l.id]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => repay(l.id)}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    >
                      Repay
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
