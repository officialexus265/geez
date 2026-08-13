import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, verifyPayment } from "@/lib/paychangu";

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL || "https://geez-lac.vercel.app"
  ).replace(/\/$/, "");
}

/**
 * Browser redirect (PayChangu sometimes sends users here instead of return_url).
 * Redirect to the success UI — never show a raw API 405.
 */
function redirectToReturn(txRef: string, status?: string) {
  const dest = new URL(`${appBase()}/deposit/return`);
  if (txRef) dest.searchParams.set("tx_ref", txRef);
  if (status) dest.searchParams.set("status", status);
  return NextResponse.redirect(dest.toString(), 303);
}

export async function GET(request: NextRequest) {
  const txRef =
    request.nextUrl.searchParams.get("tx_ref") ||
    request.nextUrl.searchParams.get("txRef") ||
    request.nextUrl.searchParams.get("reference") ||
    "";
  const status =
    request.nextUrl.searchParams.get("status") ||
    request.nextUrl.searchParams.get("payment_status") ||
    "";
  return redirectToReturn(txRef, status || undefined);
}

export async function POST(request: NextRequest) {
  const accept = request.headers.get("accept") || "";
  const contentType = request.headers.get("content-type") || "";

  // Browser form POST / navigation → treat as return redirect
  const looksLikeBrowser =
    accept.includes("text/html") ||
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  if (looksLikeBrowser) {
    let txRef =
      request.nextUrl.searchParams.get("tx_ref") ||
      request.nextUrl.searchParams.get("txRef") ||
      "";
    let status = request.nextUrl.searchParams.get("status") || "";
    try {
      if (contentType.includes("form")) {
        const form = await request.formData();
        txRef = String(
          form.get("tx_ref") || form.get("txRef") || form.get("reference") || txRef
        );
        status = String(
          form.get("status") || form.get("payment_status") || status
        );
      }
    } catch {
      // ignore
    }
    return redirectToReturn(txRef, status || undefined);
  }

  // Server-to-server webhook from PayChangu
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("signature");

    if (process.env.PAYCHANGU_WEBHOOK_SECRET) {
      const valid = verifyWebhookSignature(rawBody, signature);
      if (!valid) {
        console.error("Invalid webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    }

    const payload = JSON.parse(rawBody || "{}");
    const tx_ref =
      payload?.data?.tx_ref ||
      payload?.tx_ref ||
      payload?.data?.data?.tx_ref ||
      request.nextUrl.searchParams.get("tx_ref");

    if (!tx_ref) {
      return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
    }

    const verification = await verifyPayment(tx_ref);
    const status = verification?.data?.status;

    const supabase = createAdminClient();

    if (status === "success") {
      const { data: tx } = await supabase
        .from("transactions")
        .update({
          status: "success",
          paychangu_data: verification.data,
          payment_method:
            verification?.data?.authorization?.channel
              ?.toLowerCase()
              ?.replace(" ", "_") || null,
          updated_at: new Date().toISOString(),
        })
        .eq("tx_ref", tx_ref)
        .select()
        .single();

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

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name");
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
