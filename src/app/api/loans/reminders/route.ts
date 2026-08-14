import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendSMS } from "@/lib/notifications";

const WINDOWS = [
  { days: 30, key: "rem_30" },
  { days: 15, key: "rem_15" },
  { days: 10, key: "rem_10" },
  { days: 5, key: "rem_5" },
  { days: 1, key: "rem_1" },
];

/**
 * Send loan due reminders (in-app + email + SMS).
 * Tracks sent windows in loan meta via notifications metadata or loans row.
 * Uses notifications type to avoid duplicate sends same day.
 */
export async function POST() {
  try {
    const admin = createAdminClient();
    const { data: active } = await admin
      .from("loans")
      .select("*")
      .eq("status", "active");

    let sent = 0;

    for (const loan of active || []) {
      if (!loan.due_at) continue;
      const due = new Date(loan.due_at).getTime();
      const now = Date.now();
      const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

      const match = WINDOWS.find((w) => daysLeft === w.days);
      if (!match) continue;

      // Dedupe: check notification in last 20 hours for this window
      const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", loan.user_id)
        .eq("type", "system")
        .gte("created_at", since)
        .contains("metadata", { loan_id: loan.id, reminder: match.key })
        .limit(1);

      if (existing && existing.length) continue;

      const remaining =
        Number(loan.total_repayable) - Number(loan.amount_repaid || 0);
      const warning =
        match.days === 1
          ? " If not settled, the amount will be deducted from your fixed savings goals."
          : "";
      const body = `Loan reminder: ${match.days} day(s) remaining. Amount left ~ MWK ${remaining.toFixed(0)}.${warning}`;

      await admin.from("notifications").insert({
        user_id: loan.user_id,
        title: `Loan due in ${match.days} day(s)`,
        body,
        type: "system",
        metadata: { loan_id: loan.id, reminder: match.key },
      });

      // Optional chat system message if thread exists
      const { data: thread } = await admin
        .from("chat_threads")
        .select("id")
        .eq("user_id", loan.user_id)
        .eq("thread_type", "user")
        .maybeSingle();

      if (thread) {
        await admin.from("chat_messages").insert({
          thread_id: thread.id,
          sender_id: null,
          body: `[System] ${body}`,
          is_from_admin: true,
          is_system: true,
        });
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("email, phone, full_name")
        .eq("id", loan.user_id)
        .single();

      if (profile?.email) {
        try {
          await sendEmail({
            to: profile.email,
            subject: `GEEZ — Loan due in ${match.days} day(s)`,
            html: `<p>Hi ${profile.full_name || ""},</p><p>${body}</p>`,
          });
        } catch (e) {
          console.error("reminder email", e);
        }
      }
      if (profile?.phone) {
        try {
          await sendSMS({
            to: profile.phone,
            content: `GEEZ: ${body}`.slice(0, 160),
          });
        } catch (e) {
          console.error("reminder sms", e);
        }
      }

      sent++;
    }

    return NextResponse.json({ sent });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
