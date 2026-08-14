"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpFromLine,
  Loader2,
  Smartphone,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { formatMWK } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "confirm" | "success";

export default function WithdrawPage() {
  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState<"airtel_money" | "tnm_mpamba">(
    "airtel_money"
  );
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const [feeInfo, setFeeInfo] = useState<{
    fee_percent: number;
    fee_amount: number;
    net_amount: number;
    is_early_exit?: boolean;
  } | null>(null);
  const [sourceType, setSourceType] = useState<"general" | "goal">("general");
  const [goals, setGoals] = useState<
    { id: string; title: string; current_amount: number; goal_type?: string; end_date?: string | null }[]
  >([]);
  const [goalId, setGoalId] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("goals")
        .select("id, title, current_amount, goal_type, end_date")
        .or(`created_by.eq.${user.id},owner_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      setGoals((data as any) || []);
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", user.id)
        .single();
      if (profile?.phone) setPhone(profile.phone);
    }
    load();
  }, []);

  const gross = Number(amount) || 0;
  const previewFeePct =
    sourceType === "goal" && goalId
      ? (() => {
          const g = goals.find((x) => x.id === goalId);
          if (g?.goal_type === "fixed") {
            const end = g.end_date;
            const matured = end ? new Date(end) <= new Date() : false;
            return matured ? 3 : 6;
          }
          return 3;
        })()
      : 3;
  const previewFee = Math.round(gross * (previewFeePct / 100) * 100) / 100;
  const previewNet = Math.round((gross - previewFee) * 100) / 100;

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = Number(amount);
    if (!num || num < 100) {
      setError("Minimum withdrawal is MWK 100");
      return;
    }
    if (!phone || phone.length < 9) {
      setError("Enter a valid phone number");
      return;
    }
    if (sourceType === "goal" && !goalId) {
      setError("Select a goal");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          destination_type: destination,
          phone_number: phone,
          source_type: sourceType,
          goal_id: sourceType === "goal" ? goalId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start withdrawal");

      setWithdrawalId(data.id);
      setFeeInfo({
        fee_percent: data.fee_percent,
        fee_amount: data.fee_amount,
        net_amount: data.net_amount,
        is_early_exit: data.is_early_exit,
      });
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Enter the code from your email");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          withdrawal_id: withdrawalId,
          code: code.trim(),
          pin: pin || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Confirmation failed");
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ArrowUpFromLine className="h-6 w-6 text-primary" />
          Withdraw
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Airtel Money or TNM Mpamba · fee shown before you confirm
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "form" && (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onSubmit={handleStart}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceType("general")}
                className={`rounded-xl border p-3 text-sm ${
                  sourceType === "general"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border"
                }`}
              >
                General savings
              </button>
              <button
                type="button"
                onClick={() => setSourceType("goal")}
                className={`rounded-xl border p-3 text-sm ${
                  sourceType === "goal"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border"
                }`}
              >
                From a goal
              </button>
            </div>

            {sourceType === "goal" && (
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
                required
              >
                <option value="">Select goal</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} · {formatMWK(Number(g.current_amount))}
                    {g.goal_type === "fixed" ? " · Fixed" : ""}
                  </option>
                ))}
              </select>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">Amount (MWK)</label>
              <input
                type="number"
                min={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
                placeholder="100"
                required
              />
            </div>

            {gross >= 100 && (
              <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
                <p>
                  Fee (~{previewFeePct}
                  {sourceType === "goal" && goalId && goals.find((g) => g.id === goalId)?.goal_type === "fixed"
                    ? previewFeePct === 6
                      ? "% early exit"
                      : "% maturity"
                    : "%"}
                  ): <strong>{formatMWK(previewFee)}</strong>
                </p>
                <p className="mt-1">
                  You receive: <strong>{formatMWK(previewNet)}</strong>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDestination("airtel_money")}
                className={`rounded-xl border p-3 text-sm ${
                  destination === "airtel_money"
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                Airtel Money
              </button>
              <button
                type="button"
                onClick={() => setDestination("tnm_mpamba")}
                className={`rounded-xl border p-3 text-sm ${
                  destination === "tnm_mpamba"
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                TNM Mpamba
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                <Smartphone className="mr-1 inline h-4 w-4" />
                Phone number
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
                placeholder="088..."
                required
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Send confirmation code"}
            </button>
          </motion.form>
        )}

        {step === "confirm" && (
          <motion.form
            key="confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleConfirm}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <p>Code sent to your email.</p>
              {feeInfo && (
                <p className="mt-2">
                  Fee {feeInfo.fee_percent}% ({formatMWK(feeInfo.fee_amount)}) · You get{" "}
                  <strong>{formatMWK(feeInfo.net_amount)}</strong>
                  {feeInfo.is_early_exit ? " · early exit" : ""}
                </p>
              )}
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Email code"
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
              required
            />
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-sm font-medium">
                <Lock className="h-4 w-4" /> PIN (if you set one)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
                placeholder="Optional if no PIN"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Confirming…" : "Confirm withdrawal"}
            </button>
          </motion.form>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-border bg-card p-8 text-center"
          >
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-4 font-semibold">Withdrawal submitted</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {feeInfo
                ? `Net ${formatMWK(feeInfo.net_amount)} to your phone`
                : "Check your mobile money shortly"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
