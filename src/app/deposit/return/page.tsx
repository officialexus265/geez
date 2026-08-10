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

  const [status, setStatus] = useState<"loading" | "success" | "failed">(
    "loading"
  );

  useEffect(() => {
    // In production we would re-verify with our backend
    if (statusParam === "failed") {
      setStatus("failed");
    } else if (tx_ref) {
      // Optimistic success for now — real verification happens via webhook
      const timer = setTimeout(() => setStatus("success"), 800);
      return () => clearTimeout(timer);
    } else {
      setStatus("failed");
    }
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
            <p className="mt-4 text-muted-foreground">Confirming payment…</p>
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
            <p className="mt-2 text-muted-foreground">
              Your deposit is being confirmed.
              <br />
              You’ll receive a receipt shortly.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
              >
                Go to Dashboard
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
