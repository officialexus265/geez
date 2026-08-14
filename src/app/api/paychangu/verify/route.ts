import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayment } from "@/lib/paychangu";

const ALLOWED_METHODS = new Set([
  "airtel_money",
  "tnm_mpamba",
  "bank",
  "card",
  "other",
]);

function mapPaymentMethod(channel: unknown): string | null {
  if (!channel || typeof channel !== "string") return null;
  const raw = channel.toLowerCase().replace(/\s+/g, "_");
  if (ALLOWED_METHODS.has(raw)) return raw;
  if (raw.includes("airtel")) return "airtel_money";
  if (raw.includes("tnm") || raw.includes("mpamba")) return "tnm_mpamba";
  if (raw.includes("card")) return "card";
  if (raw.includes("bank")) return "bank";
  return "other";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tx_ref } = body;

    if (!tx_ref) {
      return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      return NextResponse.json(
        { error: "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const verification = await verifyPayment(tx_ref);
    const status =
      verification?.data?.status ||
      verification?.status ||
      verification?.data?.data?.status;

    console.log("[verify]", tx_ref, "paychangu status=", status);

    const supabase = createAdminClient();

    if (status === "success" || status === "successful") {
      const method = mapPaymentMethod(
        verification?.data?.authorization?.channel ||
          verification?.data?.payment_method ||
          verification?.data?.data?.authorization?.channel
      );

      // Minimal update first — status only — so constraint issues can't block success
      const { data: updated, error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "success",
          updated_at: new Date().toISOString(),
        })
        .eq("tx_ref", tx_ref)
        .select("*")
        .maybeSingle();

      if (updateError) {
        console.error("[verify] status update failed:", updateError);
        return NextResponse.json(
          {
            status: "success",
            db_updated: false,
            error: updateError.message,
            hint: "PayChangu OK but DB update failed",
          },
          { status: 500 }
        );
      }

      if (!updated) {
        console.error("[verify] no row found for", tx_ref);
        return NextResponse.json(
          {
            status: "success",
            db_updated: false,
            error: "No transaction row found for this tx_ref",
          },
          { status: 404 }
        );
      }

      // Best-effort extras (must not undo status=success)
      const extras: Record<string, unknown> = {
        paychangu_data: verification.data ?? verification,
      };
      if (method) extras.payment_method = method;

      await supabase
        .from("transactions")
        .update(extras)
        .eq("tx_ref", tx_ref);

      // Credit goal or general balance (once when first marked success)
      const amt = Number(updated.amount);
      if ((updated as any).goal_id) {
        const { data: goal } = await supabase
          .from("goals")
          .select("id, current_amount, target_amount")
          .eq("id", (updated as any).goal_id)
          .single();

        if (goal) {
          const newAmount = Number(goal.current_amount) + amt;
          await supabase
            .from("goals")
            .update({
              current_amount: newAmount,
              is_completed: newAmount >= Number(goal.target_amount),
              updated_at: new Date().toISOString(),
            })
            .eq("id", goal.id);
        }
      } else if ((updated as any).depositor_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("general_balance")
          .eq("id", (updated as any).depositor_id)
          .single();
        if (prof) {
          await supabase
            .from("profiles")
            .update({
              general_balance: Number(prof.general_balance || 0) + amt,
            })
            .eq("id", (updated as any).depositor_id);
        }
      }

      return NextResponse.json({
        status: "success",
        db_updated: true,
        transaction: updated,
      });
    }

    if (status === "failed" || status === "cancelled") {
      await supabase
        .from("transactions")
        .update({
          status: status === "cancelled" ? "cancelled" : "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("tx_ref", tx_ref);

      return NextResponse.json({ status });
    }

    return NextResponse.json({ status: status || "pending" });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
