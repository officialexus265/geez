"use client";

import { useEffect, useRef, useState } from "react";
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
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("messages")
        .select("id, user_id, body, created_at, profiles(full_name, avatar_url)")
        .order("created_at", { ascending: true })
        .limit(100);

      setMessages((data as any) || []);
      setLoading(false);

      // Realtime
      const channel = supabase
        .channel("chat")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const { data: row } = await supabase
              .from("messages")
              .select("id, user_id, body, created_at, profiles(full_name, avatar_url)")
              .eq("id", payload.new.id)
              .single();
            if (row) setMessages((prev) => [...prev, row as any]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
    init();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !userId) return;
    setSending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("messages").insert({
        user_id: userId,
        body: text.trim(),
      });
      if (error) throw error;
      setText("");
    } catch (err) {
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
                animate={{ opacity: 1, y: 0 }}
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
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {formatDate(m.created_at)}
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
