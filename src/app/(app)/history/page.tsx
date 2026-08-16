"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  History,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Download,
} from "lucide-react";
import Link from "next/link";
import { formatMWK, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useHideBalance } from "@/hooks/use-hide-balance";

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
  const { hidden } = useHideBalance();
  const [search, setSearch] = useState("");


  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("dual_pair_id, account_type")
          .eq("id", user.id)
          .single();

        let depositorIds: string[] = [user.id];
        if (profile?.dual_pair_id && profile?.account_type === "dual") {
          const { data: pair } = await supabase
            .from("dual_pairs")
            .select("created_by, partner_id")
            .eq("id", profile.dual_pair_id)
            .maybeSingle();
          if (pair) {
            depositorIds = [pair.created_by, pair.partner_id].filter(
              Boolean
            ) as string[];
          }
        }

        const { data: deposits } = await supabase
          .from("transactions")
          .select(
            "id, amount, status, depositor_name, depositor_id, note, created_at, tx_ref"
          )
          .in("depositor_id", depositorIds)
          .order("created_at", { ascending: false });

        const { data: withdrawals } = await supabase
          .from("withdrawals")
          .select("id, amount, status, phone_number, created_at, initiated_by")
          .eq("initiated_by", user.id)
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

  function exportCSV() {
    const rows = [["Type", "Name", "Amount", "Status", "Date", "Note", "Reference"]];
    items.forEach((tx) => {
      rows.push([
        tx.type,
        tx.name,
        String(tx.amount),
        tx.status,
        tx.created_at,
        tx.note || "",
        tx.tx_ref || "",
      ]);
    });
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geez-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const q = search.trim().toLowerCase();
  const filteredItems = items.filter((it) => {
    if (filter !== "all" && it.type !== filter) return false;
    if (!q) return true;
    return (
      it.name.toLowerCase().includes(q) ||
      (it.note || "").toLowerCase().includes(q) ||
      (it.tx_ref || "").toLowerCase().includes(q) ||
      it.status.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your deposits and withdrawals
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search history…"
        className="w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm"
      />

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

      {filteredItems.length === 0 ? (
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
          {filteredItems.map((tx, i) => (
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
                  {hidden ? "•••" : formatMWK(tx.amount)}
                </p>
                <p className="text-[10px] capitalize text-muted-foreground">
                  {tx.status.replace("_", " ")}
                </p>
                {tx.type === "deposit" && tx.status === "success" && (
                  <Link
                    href={`/receipt/${tx.id}`}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Receipt
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
