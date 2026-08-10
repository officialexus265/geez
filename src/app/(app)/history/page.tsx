"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { formatMWK, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Filter = "all" | "deposit" | "withdrawal";

interface TxItem {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  status: string;
  name: string;
  note?: string | null;
  created_at: string;
  tx_ref?: string;
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();

        const { data: deposits } = await supabase
          .from("transactions")
          .select("id, amount, status, depositor_name, note, created_at, tx_ref")
          .order("created_at", { ascending: false });

        const { data: withdrawals } = await supabase
          .from("withdrawals")
          .select("id, amount, status, phone_number, created_at, initiated_by")
          .order("created_at", { ascending: false });

        const mapped: TxItem[] = [];

        (deposits || []).forEach((d) => {
          mapped.push({
            id: d.id,
            type: "deposit",
            amount: Number(d.amount),
            status: d.status,
            name: d.depositor_name,
            note: d.note,
            created_at: d.created_at,
            tx_ref: d.tx_ref,
          });
        });

        (withdrawals || []).forEach((w) => {
          mapped.push({
            id: w.id,
            type: "withdrawal",
            amount: Number(w.amount),
            status: w.status,
            name: w.phone_number,
            created_at: w.created_at,
          });
        });

        mapped.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setItems(mapped);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered =
    filter === "all" ? items : items.filter((t) => t.type === filter);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All deposits and withdrawals
        </p>
      </div>

      <div className="flex gap-2">
        {(["all", "deposit", "withdrawal"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f === "all" ? "All" : f + "s"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <History className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No transactions yet. Your history will appear here.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  tx.type === "deposit"
                    ? "bg-success/15 text-success"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {tx.type === "deposit" ? (
                  <ArrowDownLeft className="h-5 w-5" />
                ) : (
                  <ArrowUpRight className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {tx.type === "deposit" ? "Deposit" : "Withdrawal"} · {tx.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(tx.created_at)}
                  {tx.note ? ` · ${tx.note}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${
                    tx.type === "deposit" ? "text-success" : "text-foreground"
                  }`}
                >
                  {tx.type === "deposit" ? "+" : "-"}
                  {formatMWK(tx.amount)}
                </p>
                <p className="text-[10px] capitalize text-muted-foreground">
                  {tx.status.replace("_", " ")}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
