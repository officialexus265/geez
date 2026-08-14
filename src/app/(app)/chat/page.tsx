"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, MessageCircle, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

interface ChatMsg {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  is_from_admin: boolean;
  is_system: boolean;
  created_at: string;
  _optimistic?: boolean;
}

interface ThreadRow {
  id: string;
  user_id: string | null;
  dual_pair_id: string | null;
  subject: string | null;
  last_message_at: string | null;
  profiles?: { full_name: string } | null;
}

export default function ChatPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [ringtoneUrl, setRingtoneUrl] = useState<string | null>(null);

  const playSound = useCallback(() => {
    try {
      if (ringtoneUrl) {
        const a = new Audio(ringtoneUrl);
        a.volume = 0.7;
        a.play().catch(() => {});
        return;
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      /* ignore */
    }
  }, [ringtoneUrl]);

  async function ensureMemberThread(uid: string) {
    const supabase = createClient();
    let { data: thread } = await supabase
      .from("chat_threads")
      .select("*")
      .eq("user_id", uid)
      .eq("thread_type", "user")
      .maybeSingle();

    if (!thread) {
      const { data: created, error } = await supabase
        .from("chat_threads")
        .insert({
          user_id: uid,
          thread_type: "user",
          subject: "Support",
        })
        .select()
        .single();
      if (error) throw error;
      thread = created;
    }
    return thread;
  }

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = (profile?.role || "").toLowerCase();
      const admin = ["super_admin", "admin", "support", "finance"].includes(role);
      setIsAdmin(admin);

      const { data: settings } = await supabase
        .from("app_settings")
        .select("ringtone_url")
        .eq("id", "main")
        .maybeSingle();
      if (settings?.ringtone_url) setRingtoneUrl(settings.ringtone_url);

      if (admin) {
        const { data: list } = await supabase
          .from("chat_threads")
          .select("id, user_id, dual_pair_id, subject, last_message_at")
          .order("last_message_at", { ascending: false, nullsFirst: false });
        setThreads((list as ThreadRow[]) || []);
        setLoading(false);
      } else {
        const thread = await ensureMemberThread(user.id);
        setThreadId(thread.id);
        await loadMessages(thread.id);
        setLoading(false);

        channel = supabase
          .channel(`chat-${thread.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "chat_messages",
              filter: `thread_id=eq.${thread.id}`,
            },
            (payload) => {
              const row = payload.new as ChatMsg;
              setMessages((prev) => {
                if (prev.some((m) => m.id === row.id)) return prev;
                if (row.sender_id !== user.id) playSound();
                return [...prev.filter((m) => !m._optimistic), row];
              });
            }
          )
          .subscribe();
      }
    }

    init();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [playSound]);

  async function loadMessages(tid: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", tid)
      .order("created_at", { ascending: true });
    setMessages((data as ChatMsg[]) || []);
  }

  async function openThread(t: ThreadRow) {
    setThreadId(t.id);
    await loadMessages(t.id);
    const supabase = createClient();
    supabase
      .channel(`chat-admin-${t.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${t.id}`,
        },
        (payload) => {
          const row = payload.new as ChatMsg;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      )
      .subscribe();
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !threadId || !userId) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        thread_id: threadId,
        sender_id: userId,
        body,
        is_from_admin: isAdmin,
        is_system: false,
        created_at: new Date().toISOString(),
        _optimistic: true,
      },
    ]);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("chat_messages").insert({
        thread_id: threadId,
        sender_id: userId,
        body,
        is_from_admin: isAdmin,
        is_system: false,
      });
      if (error) throw error;
      await supabase
        .from("chat_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", threadId);
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admin thread list
  if (isAdmin && !threadId) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="h-6 w-6 text-primary" />
          Support inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Message members about loans, policies, and help.
        </p>
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No threads yet. They appear when a user opens Chat.
          </p>
        ) : (
          <div className="space-y-2">
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openThread(t)}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm hover:bg-muted"
              >
                <p className="font-medium">
                  {t.subject || "Support"} · {t.user_id?.slice(0, 8)}…
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.last_message_at
                    ? formatDate(t.last_message_at)
                    : "No messages"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-lg flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <MessageCircle className="h-5 w-5 text-primary" />
          {isAdmin ? "Reply" : "Chat with support"}
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setThreadId(null);
              setMessages([]);
            }}
            className="text-xs text-primary"
          >
            All threads
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-card/50 p-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isAdmin
              ? "No messages in this thread yet."
              : "Ask admin anything — loans, deposits, or account help."}
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.is_system
                    ? "bg-muted text-muted-foreground"
                    : mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                }`}
              >
                {m.is_from_admin && !mine && !m.is_system && (
                  <p className="mb-0.5 text-[10px] font-semibold opacity-80">
                    Admin
                  </p>
                )}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {formatDate(m.created_at)}
                </p>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-2xl border border-input bg-background px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-2xl bg-primary px-4 text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
