import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyWebhookSignature, verifyPayment } from "@/lib/paychangu";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("signature");

    // Verify signature when webhook secret is configured
    if (process.env.PAYCHANGU_WEBHOOK_SECRET) {
      const valid = verifyWebhookSignature(rawBody, signature);
      if (!valid) {
        console.error("Invalid webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    }

    const payload = JSON.parse(rawBody);
    const tx_ref =
      payload?.data?.tx_ref ||
      payload?.tx_ref ||
      payload?.data?.data?.tx_ref;

    if (!tx_ref) {
      return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
    }

    // Always verify server-side with PayChangu
    const verification = await verifyPayment(tx_ref);
    const status = verification?.data?.status;

    const supabase = await createClient();

    if (status === "success") {
      const { data: tx } = await supabase
        .from("transactions")
        .update({
          status: "success",
          paychangu_data: verification.data,
          payment_method: verification?.data?.authorization?.channel
            ?.toLowerCase()
            ?.replace(" ", "_") || null,
          updated_at: new Date().toISOString(),
        })
        .eq("tx_ref", tx_ref)
        .select()
        .single();

      // If linked to a goal, increase current_amount
      if (tx && (tx as any).goal_id) {
        const { data: goal } = await supabase
          .from("goals")
          .select("id, current_amount, target_amount")
          .eq("id", (tx as any).goal_id)
          .single();

        if (goal) {
          const newAmount = Number(goal.current_amount) + Number(tx.amount);
          await supabase
            .from("goals")
            .update({
              current_amount: newAmount,
              is_completed: newAmount >= Number(goal.target_amount),
              updated_at: new Date().toISOString(),
            })
            .eq("id", goal.id);
        }
      }

      // In-app notifications for both users
      const { data: profiles } = await supabase.from("profiles").select("id, email, full_name");
      if (profiles && tx) {
        for (const p of profiles) {
          await supabase.from("notifications").insert({
            user_id: p.id,
            title: "New deposit ❤️",
            body: `${tx.depositor_name} deposited MWK ${tx.amount}`,
            type: "deposit",
            metadata: { tx_ref, amount: tx.amount },
          });
          if (p.email) {
            try {
              const { sendEmail } = await import("@/lib/notifications");
              await sendEmail({
                to: p.email,
                subject: `GEEZ — Deposit of MWK ${tx.amount} received`,
                html: `<h2>Deposit confirmed</h2><p><strong>${tx.depositor_name}</strong> just added <strong>MWK ${tx.amount}</strong> to your shared savings.</p><p>Reference: ${tx_ref}</p><p>Thank you for growing together ❤️</p>`,
              });
            } catch (e) {
              console.error("Email send failed", e);
            }
          }
        }
      }
    } else if (status === "failed" || status === "cancelled") {
      await supabase
        .from("transactions")
        .update({
          status: status === "cancelled" ? "cancelled" : "failed",
          paychangu_data: verification.data,
          updated_at: new Date().toISOString(),
        })
        .eq("tx_ref", tx_ref);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
