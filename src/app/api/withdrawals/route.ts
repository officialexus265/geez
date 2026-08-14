import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateConfirmationCode,
  sendEmail,
  sendSMS,
} from "@/lib/notifications";

/**
 * POST /api/withdrawals
 * User-initiated withdraw → email OTP to themselves → fee applied at confirm
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

    const body = await request.json();
    const {
      amount,
      destination_type,
      phone_number,
      source_type = "general",
      goal_id = null,
    } = body;

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Minimum withdrawal is MWK 100" },
        { status: 400 }
      );
    }

    if (!["airtel_money", "tnm_mpamba"].includes(destination_type)) {
      return NextResponse.json(
        { error: "Invalid destination" },
        { status: 400 }
      );
    }

    if (!phone_number) {
      return NextResponse.json(
        { error: "Phone number required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: me } = await admin
      .from("profiles")
      .select("id, email, full_name, phone, general_balance, dual_pair_id")
      .eq("id", user.id)
      .single();

    if (!me) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let feePercent = 3;
    let isEarlyExit = false;
    let goal: any = null;

    if (source_type === "goal" && goal_id) {
      const { data: g } = await admin
        .from("goals")
        .select("*")
        .eq("id", goal_id)
        .single();
      goal = g;
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      if (Number(goal.current_amount) < amount) {
        return NextResponse.json(
          { error: "Insufficient goal balance" },
          { status: 400 }
        );
      }

      // Block if active loans (Phase 3 will enforce fully)
      const { data: loans } = await admin
        .from("loans")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);
      if (loans && loans.length > 0 && goal.goal_type === "fixed") {
        return NextResponse.json(
          {
            error:
              "Repay open loans before withdrawing from or closing a fixed goal",
          },
          { status: 400 }
        );
      }

      if (goal.goal_type === "fixed") {
        const end = goal.end_date || goal.deadline;
        const matured = end ? new Date(end) <= new Date() : false;
        if (!matured) {
          feePercent = 6;
          isEarlyExit = true;
        } else {
          feePercent = 3;
        }
      } else {
        feePercent = 3;
      }
    }

    // Settings override defaults
    const { data: settings } = await admin
      .from("app_settings")
      .select("withdraw_fee_percent, early_exit_fee_percent, maturity_fee_percent")
      .eq("id", "main")
      .maybeSingle();

    if (settings) {
      if (isEarlyExit && settings.early_exit_fee_percent != null) {
        feePercent = Number(settings.early_exit_fee_percent);
      } else if (!isEarlyExit && settings.maturity_fee_percent != null && source_type === "goal") {
        feePercent = Number(settings.maturity_fee_percent);
      } else if (source_type === "general" && settings.withdraw_fee_percent != null) {
        feePercent = Number(settings.withdraw_fee_percent);
      }
    }

    const feeAmount = Math.round(amount * (feePercent / 100) * 100) / 100;
    const netAmount = Math.round((amount - feeAmount) * 100) / 100;
    const code = generateConfirmationCode();

    const { data: withdrawal, error: wErr } = await admin
      .from("withdrawals")
      .insert({
        amount,
        currency: "MWK",
        destination_type,
        phone_number,
        status: "pending_confirmation",
        initiated_by: user.id,
        confirmation_code: code,
        fee_percent: feePercent,
        fee_amount: feeAmount,
        net_amount: netAmount,
        source_type,
        goal_id: goal_id || null,
        is_early_exit: isEarlyExit,
        confirmation_email: me.email,
      })
      .select()
      .single();

    if (wErr) {
      console.error(wErr);
      return NextResponse.json(
        { error: wErr.message || "Could not create withdrawal" },
        { status: 500 }
      );
    }

    // Send code to the user (email + SMS if phone)
    const msg = `GEEZ withdraw code: ${code}. Amount MWK ${amount}, fee ${feePercent}% (MWK ${feeAmount}), you receive MWK ${netAmount}.`;

    if (me.email) {
      try {
        await sendEmail({
          to: me.email,
          subject: "GEEZ — Withdrawal confirmation code",
          html: `<p>Hi ${me.full_name || ""},</p>
            <p>Your confirmation code is <strong>${code}</strong></p>
            <p>Withdraw: MWK ${amount}<br/>Fee (${feePercent}%): MWK ${feeAmount}<br/>
            <strong>You receive: MWK ${netAmount}</strong></p>
            <p>Destination: ${destination_type} ${phone_number}</p>`,
        });
      } catch (e) {
        console.error("Email failed", e);
      }
    }

    if (me.phone || phone_number) {
      try {
        await sendSMS({
          to: me.phone || phone_number,
          message: msg,
        });
      } catch (e) {
        console.error("SMS failed", e);
      }
    }

    return NextResponse.json({
      id: withdrawal.id,
      fee_percent: feePercent,
      fee_amount: feeAmount,
      net_amount: netAmount,
      is_early_exit: isEarlyExit,
      message: "Confirmation code sent to your email",
    });
  } catch (err) {
    console.error("Withdraw start error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
