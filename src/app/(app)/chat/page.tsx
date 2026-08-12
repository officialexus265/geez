"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

interface Message {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string | null } | null;
  _optimistic?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState("You");
  const [ringtoneUrl, setRingtoneUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userIdRef = useRef<string | null>(null);

  const playSound = useCallback(() => {
    try {
      if (ringtoneUrl) {
        const a = new Audio(ringtoneUrl);
        a.volume = 0.7;
        a.play().catch(() => {});
        return;
      }
      // Fallback: short beep via Web Audio API
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
      // ignore autoplay restrictions
    }
  }, [ringtoneUrl]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      userIdRef.current = user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile?.full_name) setMyName(profile.full_name);

      const { data: settings } = await supabase
        .from("app_settings")
        .select("ringtone_url")
        .eq("id", "main")
        .maybeSingle();
      if ((settings as any)?.ringtone_url) {
        setRingtoneUrl((settings as any).ringtone_url);
      }

      const { data } = await supabase
        .from("messages")
        .select("id, user_id, body, created_at, profiles(full_name, avatar_url)")
        .order("created_at", { ascending: true })
        .limit(150);

      setMessages((data as any) || []);
      setLoading(false);

      channel = supabase
        .channel("geez-chat-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const row = payload.new as Message;
            // Avoid duplicates (optimistic already added)
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              // Replace optimistic temp message with real one
              const withoutOptimistic = prev.filter(
                (m) =>
                  !(
                    m._optimistic &&
                    m.body === row.body &&
                    m.user_id === row.user_id
                  )
              );
              return [
                ...withoutOptimistic,
                {
                  ...row,
                  profiles: row.profiles || null,
                },
              ];
            });

            // Fetch profile name if missing
            if (!row.profiles) {
              const { data: full } = await supabase
                .from("messages")
                .select("id, user_id, body, created_at, profiles(full_name, avatar_url)")
                .eq("id", row.id)
                .single();
              if (full) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === row.id ? (full as any) : m))
                );
              }
            }

            // Sound only for partner messages
            if (row.user_id !== userIdRef.current) {
              playSound();
            }
          }
        )
        .subscribe((status) => {
          console.log("[chat] realtime status:", status);
        });
    }

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [playSound]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !userId) return;

    const body = text.trim();
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      user_id: userId,
      body,
      created_at: new Date().toISOString(),
      profiles: { full_name: myName, avatar_url: null },
      _optimistic: true,
    };

    // Show immediately
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setSending(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .insert({ user_id: userId, body })
        .select("id, user_id, body, created_at, profiles(full_name, avatar_url)")
        .single();

      if (error) throw error;

      // Replace optimistic with real row
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? (data as any) : m))
      );
    } catch (err) {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert(err instanceof Error ? err.message : "Failed to send");
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

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageCircle className="h-6 w-6 text-primary" />
          Chat
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Private messages between you two
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card/50 p-4">
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No messages yet. Say something nice ❤️
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === userId;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: m._optimistic ? 0.7 : 1, y: 0 }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 text-[10px] font-medium opacity-70">
                      {m.profiles?.full_name || "Partner"}
                    </p>
                  )}
                  <p>{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      mine
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {m._optimistic ? "Sending…" : formatDate(m.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
}
