import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/pin";
import {
  initiateMobileMoneyPayout,
  MOBILE_MONEY_OPERATORS,
} from "@/lib/paychangu";

/**
 * POST /api/withdrawals/confirm
 * Verify email code + PIN → mark processing, fee ledger, debit goal if any
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { withdrawal_id, code, pin } = await request.json();

    if (!withdrawal_id || !code) {
      return NextResponse.json(
        { error: "Missing withdrawal_id or code" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: w } = await admin
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    if (!w || w.initiated_by !== user.id) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (w.status !== "pending_confirmation") {
      return NextResponse.json(
        { error: "Withdrawal is not awaiting confirmation" },
        { status: 400 }
      );
    }

    if (String(w.confirmation_code) !== String(code).trim()) {
      return NextResponse.json({ error: "Invalid confirmation code" }, { status: 400 });
    }

    // PIN optional if user has one set
    const { data: profile } = await admin
      .from("profiles")
      .select("pin_hash, email, full_name")
      .eq("id", user.id)
      .single();

    if (profile?.pin_hash) {
      if (!pin) {
        return NextResponse.json({ error: "PIN required" }, { status: 400 });
      }
      const ok = await verifyPin(pin, profile.pin_hash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect PIN" }, { status: 400 });
      }
    }

    // Debit goal balance if source is goal
    if (w.source_type === "goal" && w.goal_id) {
      const { data: goal } = await admin
        .from("goals")
        .select("*")
        .eq("id", w.goal_id)
        .single();
      if (!goal || Number(goal.current_amount) < Number(w.amount)) {
        return NextResponse.json(
          { error: "Insufficient goal balance" },
          { status: 400 }
        );
      }
      await admin
        .from("goals")
        .update({
          current_amount: Number(goal.current_amount) - Number(w.amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", w.goal_id);
    }

    // Fee ledger
    if (Number(w.fee_amount) > 0) {
      const feeType = w.is_early_exit
        ? "early_exit_6"
        : w.source_type === "goal"
          ? "maturity_3"
          : "withdraw_3";
      await admin.from("fee_ledger").insert({
        user_id: user.id,
        withdrawal_id: w.id,
        goal_id: w.goal_id || null,
        fee_type: feeType,
        amount: w.fee_amount,
        meta: { fee_percent: w.fee_percent, gross: w.amount, net: w.net_amount },
      });
    }

    await admin
      .from("withdrawals")
      .update({
        status: "processing",
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", w.id);

    // Attempt PayChangu payout if configured
    try {
      const operator =
        w.destination_type === "airtel_money"
          ? MOBILE_MONEY_OPERATORS?.AIRTEL || "airtel"
          : MOBILE_MONEY_OPERATORS?.TNM || "tnm";

      if (typeof initiateMobileMoneyPayout === "function") {
        await initiateMobileMoneyPayout({
          amount: Number(w.net_amount ?? w.amount),
          phone: w.phone_number,
          operator,
          reference: `GEEZ-WD-${w.id.slice(0, 8)}`,
        });
      }

      await admin
        .from("withdrawals")
        .update({ status: "success", updated_at: new Date().toISOString() })
        .eq("id", w.id);
    } catch (payoutErr) {
      console.error("Payout error (marked processing):", payoutErr);
      // stays processing for manual admin follow-up
    }

    return NextResponse.json({
      status: "ok",
      net_amount: w.net_amount,
      fee_amount: w.fee_amount,
    });
  } catch (err) {
    console.error("Confirm withdraw error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
