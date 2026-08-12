"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, X, Loader2, Pencil, Trash2 } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hidden } = useHideBalance();

  async function loadGoals() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setGoals(data || []);
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
    setError(null);
    setShowForm(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setTitle(goal.title);
    setTarget(String(goal.target_amount));
    setEmoji(goal.emoji || "🎯");
    setError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !target) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editing) {
        const { data, error } = await supabase
          .from("goals")
          .update({
            title: title.trim(),
            target_amount: Number(target),
            emoji,
          })
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw error;
        setGoals((prev) => prev.map((g) => (g.id === editing.id ? data : g)));
      } else {
        const { data, error } = await supabase
          .from("goals")
          .insert({
            title: title.trim(),
            target_amount: Number(target),
            current_amount: 0,
            emoji,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        setGoals((prev) => [data, ...prev]);
      }

      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
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
            Save together for what matters
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {editing ? "Edit Goal" : "New Goal"}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-full p-1.5 hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Emoji</label>
                  <div className="flex flex-wrap gap-2">
                    {["🎯", "🏠", "✈️", "💍", "🚗", "📚", "💪", "❤️"].map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setEmoji(e)}
                        className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl transition ${
                          emoji === e
                            ? "bg-primary/15 ring-2 ring-primary"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Dream vacation"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    maxLength={60}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Target amount (MWK)
                  </label>
                  <input
                    type="number"
                    required
                    min={1000}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="500000"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editing ? (
                    "Save changes"
                  ) : (
                    "Create Goal"
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {goals.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Target className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No goals yet. Create your first savings goal!
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal, i) => {
            const progress = Math.min(
              100,
              (Number(goal.current_amount) / Number(goal.target_amount)) * 100
            );
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{goal.emoji || "🎯"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-semibold">{goal.title}</h3>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {Math.round(progress)}%
                        </span>
                        <button
                          onClick={() => openEdit(goal)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {hidden
                        ? `${Math.round(progress)}% complete`
                        : `${formatMWK(Number(goal.current_amount))} of ${formatMWK(Number(goal.target_amount))}`}
                    </p>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
