"use client";

import { formatMWK, formatDate } from "@/lib/utils";
import { Heart, CheckCircle2 } from "lucide-react";

interface ReceiptProps {
  tx_ref: string;
  amount: number;
  depositor_name: string;
  note?: string | null;
  created_at: string;
  payment_method?: string | null;
}

export function Receipt({
  tx_ref,
  amount,
  depositor_name,
  note,
  created_at,
  payment_method,
}: ReceiptProps) {
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      {/* Header */}
      <div className="bg-primary px-6 py-5 text-center text-primary-foreground">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
          <Heart className="h-6 w-6 fill-current" />
        </div>
        <h2 className="text-lg font-bold">GEEZ</h2>
        <p className="text-sm opacity-90">Deposit Receipt</p>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">Payment Successful</span>
        </div>

        <div className="text-center">
          <p className="text-3xl font-bold tracking-tight">
            {formatMWK(amount)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(created_at)}
          </p>
        </div>

        <div className="space-y-2.5 rounded-2xl bg-muted/50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">From</span>
            <span className="font-medium">{depositor_name}</span>
          </div>
          {payment_method && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium capitalize">
                {payment_method.replace("_", " ")}
              </span>
            </div>
          )}
          {note && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Note</span>
              <span className="text-right font-medium">{note}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reference</span>
            <span className="font-mono text-xs">{tx_ref}</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Thank you for growing our savings together ❤️
        </p>
      </div>
    </div>
  );
}
