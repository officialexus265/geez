"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpFromLine,
  Shield,
  Loader2,
  Smartphone,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { formatMWK } from "@/lib/utils";

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

    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          destination_type: destination,
          phone_number: phone.replace(/\s/g, ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start withdrawal");

      setWithdrawalId(data.withdrawal_id);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError("Enter the 6-digit code sent to your partner");
      return;
    }
    if (pin.length < 4) {
      setError("Enter your PIN");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          withdrawal_id: withdrawalId,
          code,
          pin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Confirmation failed");

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Withdraw</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dual-approval required for security
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4 text-primary">
        <Shield className="h-5 w-5 shrink-0" />
        <p className="text-sm">
          A confirmation code will be sent to your partner&apos;s email & SMS. You
          must also enter your personal PIN.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "form" && (
          <motion.form
            key="form"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            onSubmit={handleStart}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-border bg-card p-5">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Amount (MWK)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/40"
                required
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <label className="block text-sm font-medium">Destination</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDestination("airtel_money")}
                  className={`rounded-xl border py-3 text-sm font-medium transition ${
                    destination === "airtel_money"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  Airtel Money
                </button>
                <button
                  type="button"
                  onClick={() => setDestination("tnm_mpamba")}
                  className={`rounded-xl border py-3 text-sm font-medium transition ${
                    destination === "tnm_mpamba"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  TNM Mpamba
                </button>
              </div>

              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0999 123 456"
                  className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ArrowUpFromLine className="h-5 w-5" />
                  Request Withdrawal
                </>
              )}
            </button>
          </motion.form>
        )}

        {step === "confirm" && (
          <motion.form
            key="confirm"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onSubmit={handleConfirm}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">Withdrawing</p>
              <p className="mt-1 text-3xl font-bold">{formatMWK(Number(amount))}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                to {destination === "airtel_money" ? "Airtel Money" : "TNM Mpamba"} · {phone}
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Partner confirmation code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-center text-lg tracking-widest outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Sent to your partner&apos;s email & SMS
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Your PIN</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm & Send Money"}
            </button>

            <button
              type="button"
              onClick={() => setStep("form")}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </motion.form>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border border-border bg-card p-8 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold">Withdrawal initiated</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatMWK(Number(amount))} is being sent to {phone}.
              <br />
              Both of you will receive a notification.
            </p>
            <button
              onClick={() => {
                setStep("form");
                setAmount("");
                setPhone("");
                setCode("");
                setPin("");
                setWithdrawalId(null);
              }}
              className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
