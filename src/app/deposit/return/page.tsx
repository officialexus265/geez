"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Heart } from "lucide-react";

function ReturnContent() {
  const searchParams = useSearchParams();
  const tx_ref = searchParams.get("tx_ref");
  const statusParam = searchParams.get("status");

  const [status, setStatus] = useState<"loading" | "success" | "failed" | "pending">(
    "loading"
  );
  const [message, setMessage] = useState("Confirming payment…");

  useEffect(() => {
    if (statusParam === "failed") {
      setStatus("failed");
      return;
    }

    if (!tx_ref) {
      setStatus("failed");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 8;

    async function verify() {
      try {
        const res = await fetch("/api/paychangu/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tx_ref }),
        });

        const data = await res.json();

        if (cancelled) return;

        if (data.status === "success") {
          setStatus("success");
          setMessage("Your deposit has been confirmed.");
          return;
        }

        if (data.status === "failed" || data.status === "cancelled") {
          setStatus("failed");
          setMessage("Payment was not completed.");
          return;
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          setMessage(`Confirming payment… (${attempts}/${maxAttempts})`);
          setTimeout(verify, 2000);
        } else {
          setStatus("pending");
          setMessage(
            "Payment is still being processed. It will appear in History shortly."
          );
        }
      } catch {
        if (cancelled) return;
        attempts += 1;
        if (attempts < maxAttempts) {
          setTimeout(verify, 2000);
        } else {
          setStatus("pending");
          setMessage(
            "We could not confirm yet. Please check History in a moment."
          );
        }
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [tx_ref, statusParam]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center"
      >
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success"
            >
              <CheckCircle2 className="h-10 w-10" />
            </motion.div>
            <h1 className="mt-6 text-2xl font-bold">Thank you!</h1>
            <p className="mt-2 text-muted-foreground">{message}</p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/history"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                View History
              </Link>
            </div>
          </>
        )}

        {status === "pending" && (
          <>
            <Loader2 className="mx-auto h-14 w-14 text-primary" />
            <h1 className="mt-6 text-2xl font-bold">Almost there</h1>
            <p className="mt-2 text-muted-foreground">{message}</p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/history"
                className="rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
              >
                Check History
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Go to Dashboard
              </Link>
            </div>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <XCircle className="h-10 w-10" />
            </div>
            <h1 className="mt-6 text-2xl font-bold">Payment not completed</h1>
            <p className="mt-2 text-muted-foreground">
              Something went wrong or the payment was cancelled.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/deposit"
                className="rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
              >
                Try again
              </Link>
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Back to home
              </Link>
            </div>
          </>
        )}
      </motion.div>

      <p className="mt-16 text-xs text-muted-foreground">
        <Heart className="inline h-3 w-3 fill-love text-love" /> GEEZ
      </p>

      <p className="mt-4 max-w-xs text-center text-[11px] text-muted-foreground/70">
        Using the Android app? After payment, switch back to the GEEZ app if
        this page opened in your browser.
      </p>
    </div>
  );
}

export default function DepositReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReturnContent />
    </Suspense>
  );
}
