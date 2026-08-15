"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, X, Loader2, Pencil, Trash2, Lock, Calendar } from "lucide-react";
import { formatMWK } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useHideBalance } from "@/hooks/use-hide-balance";

interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  emoji: string | null;
  deadline: string | null;
  end_date: string | null;
  goal_type: "normal" | "fixed";
  is_completed: boolean;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [goalType, setGoalType] = useState<"normal" | "fixed">("normal");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hidden } = useHideBalance();

  async function loadGoals() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .or(`created_by.eq.${user.id},owner_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setGoals((data as Goal[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoals();
  }, []);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setTarget("");
    setEmoji("🎯");
    setGoalType("normal");
    setEndDate("");
    setError(null);
    setShowForm(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setTitle(goal.title);
    setTarget(String(goal.target_amount));
    setEmoji(goal.emoji || "🎯");
    setGoalType(goal.goal_type || "normal");
    setEndDate(goal.end_date || goal.deadline || "");
    setError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !target) return;
    if (goalType === "fixed" && !endDate) {
      setError("Fixed goals need an end date");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Cannot switch fixed → normal while loan is active
      if (
        editing &&
        editing.goal_type === "fixed" &&
        goalType === "normal"
      ) {
        const { data: activeLoans } = await supabase
          .from("loans")
          .select("id")
          .eq("user_id", user.id)
          .in("status", ["active", "pending_disbursement"])
          .limit(1);
        if (activeLoans && activeLoans.length) {
          throw new Error(
            "Cannot change a fixed goal to normal while you have an active loan. Repay the loan first, or cancel the goal (6% early-exit fee on the goal balance)."
          );
        }
        throw new Error(
          "Fixed goals cannot be switched to normal. Cancel the goal instead (6% processing fee on the goal balance)."
        );
      }

      const payload: Record<string, unknown> = {
        title: title.trim(),
        target_amount: Number(target),
        emoji,
        goal_type: goalType,
        end_date: goalType === "fixed" ? endDate : null,
        deadline: goalType === "fixed" ? endDate : null,
        owner_id: user.id,
        created_by: user.id,
      };

      if (editing) {
        const { error } = await supabase
          .from("goals")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert(payload);
        if (error) throw error;
      }

      setShowForm(false);
      await loadGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const goal = goals.find((g) => g.id === id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (goal?.goal_type === "fixed" && Number(goal.current_amount) > 0) {
      const { data: activeLoans } = await supabase
        .from("loans")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["active", "pending_disbursement"])
        .limit(1);
      if (activeLoans && activeLoans.length) {
        alert("Cannot cancel a fixed goal while you have an active loan.");
        return;
      }
      const bal = Number(goal.current_amount);
      const fee = Math.round(bal * 0.06 * 100) / 100;
      const net = Math.round((bal - fee) * 100) / 100;
      if (
        !confirm(
          `Cancel fixed goal? 6% early-exit fee applies.\nBalance ${bal} → fee ${fee} → ${net} moves to general savings.`
        )
      ) {
        return;
      }
      // Fee + move net to general
      const { data: profile } = await supabase
        .from("profiles")
        .select("general_balance")
        .eq("id", user.id)
        .single();
      await supabase.from("fee_ledger").insert({
        user_id: user.id,
        goal_id: id,
        fee_type: "early_exit_6",
        amount: fee,
        meta: { reason: "cancel_fixed_goal" },
      });
      await supabase
        .from("profiles")
        .update({
          general_balance: Number(profile?.general_balance || 0) + net,
        })
        .eq("id", user.id);
      await supabase.from("goals").delete().eq("id", id);
      await loadGoals();
      return;
    }

    if (!confirm("Delete this goal? Money stays in your balances — only the goal label is removed.")) {
      return;
    }
    await supabase.from("goals").delete().eq("id", id);
    await loadGoals();
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Normal plans or fixed lock until end date
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card/50 p-4 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Normal</strong> — withdraw anytime (3% fee).{" "}
          <strong className="text-foreground">Fixed</strong> — locked until end date (3% at
          maturity) or early exit (6% of amount withdrawn). Loans only use fixed balances.
        </p>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Target className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No goals yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const pct = Math.min(
              100,
              (Number(g.current_amount) / Number(g.target_amount)) * 100
            );
            const isFixed = (g.goal_type || "normal") === "fixed";
            return (
              <motion.div
                key={g.id}
                layout
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {g.emoji || "🎯"} {g.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          isFixed
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {isFixed ? (
                          <span className="inline-flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Fixed
                          </span>
                        ) : (
                          "Normal"
                        )}
                      </span>
                      {(g.end_date || g.deadline) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {g.end_date || g.deadline}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(g)}
                      className="rounded-full p-2 hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(g.id)}
                      className="rounded-full p-2 hover:bg-muted text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs">
                    <span>
                      {hidden
                        ? `${pct.toFixed(0)}%`
                        : formatMWK(Number(g.current_amount))}
                    </span>
                    <span className="text-muted-foreground">
                      {hidden ? "—" : formatMWK(Number(g.target_amount))}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setShowForm(false)}
          >
            <motion.form
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSave}
              className="w-full max-w-md space-y-4 rounded-3xl bg-card p-6 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {editing ? "Edit goal" : "New goal"}
                </h2>
                <button type="button" onClick={() => setShowForm(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGoalType("normal")}
                  className={`rounded-xl border p-3 text-sm ${
                    goalType === "normal"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border"
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setGoalType("fixed")}
                  className={`rounded-xl border p-3 text-sm ${
                    goalType === "fixed"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border"
                  }`}
                >
                  Fixed lock
                </button>
              </div>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Goal title"
                required
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
              />
              <input
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Target amount (MWK)"
                required
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
              />
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="Emoji"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
              />

              {goalType === "fixed" && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    End date (locked until then)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Early exit: 6% of amount withdrawn. At/after end date: 3% on
                    withdraw.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Update" : "Create goal"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
