import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/pin";
import {
  initiateMobileMoneyPayout,
  MOBILE_MONEY_OPERATORS,
} from "@/lib/paychangu";
import { sendEmail, sendSMS } from "@/lib/notifications";
import { randomUUID } from "crypto";

/**
 * POST /api/withdrawals/confirm
 * Verify partner code + user PIN → execute PayChangu payout
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

    if (!withdrawal_id || !code || !pin) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch withdrawal
    const { data: withdrawal, error: wError } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .eq("initiated_by", user.id)
      .single();

    if (wError || !withdrawal) {
      return NextResponse.json(
        { error: "Withdrawal not found" },
        { status: 404 }
      );
    }

    if (withdrawal.status !== "pending_confirmation") {
      return NextResponse.json(
        { error: "Withdrawal already processed" },
        { status: 400 }
      );
    }

    if (
      !withdrawal.code_expires_at ||
      new Date(withdrawal.code_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Confirmation code expired" },
        { status: 400 }
      );
    }

    if (withdrawal.confirmation_code !== code) {
      return NextResponse.json(
        { error: "Invalid confirmation code" },
        { status: 400 }
      );
    }

    // Verify PIN
    const { data: profile } = await supabase
      .from("profiles")
      .select("pin_hash, full_name, email, phone")
      .eq("id", user.id)
      .single();

    if (!profile?.pin_hash) {
      return NextResponse.json(
        { error: "Please set a withdrawal PIN in your profile first" },
        { status: 400 }
      );
    }

    // pin_hash stored as "hash:salt"
    const [storedHash, salt] = profile.pin_hash.split(":");
    if (!verifyPin(pin, storedHash, salt)) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
    }

    // Mark as processing
    await supabase
      .from("withdrawals")
      .update({ status: "processing" })
      .eq("id", withdrawal_id);

    // Execute PayChangu payout
    const operatorKey =
      withdrawal.destination_type === "airtel_money"
        ? "airtel_money"
        : "tnm_mpamba";

    const chargeId = `GEEZ-WD-${randomUUID().slice(0, 12)}`;

    try {
      const payout = await initiateMobileMoneyPayout({
        amount: Number(withdrawal.amount),
        mobile: withdrawal.phone_number,
        mobile_money_operator_ref_id: MOBILE_MONEY_OPERATORS[operatorKey],
        charge_id: chargeId,
        first_name: profile.full_name?.split(" ")[0],
      });

      await supabase
        .from("withdrawals")
        .update({
          status: "success",
          paychangu_ref: chargeId,
          paychangu_data: payout,
          confirmation_code: null, // clear code
        })
        .eq("id", withdrawal_id);

      // Notify both parties
      const successMsg = `GEEZ: Withdrawal of MWK ${withdrawal.amount} to ${withdrawal.phone_number} was successful.`;

      if (profile.email) {
        await sendEmail({
          to: profile.email,
          subject: "GEEZ — Withdrawal successful",
          html: `<p>${successMsg}</p>`,
        });
      }
      if (profile.phone) {
        await sendSMS({ to: profile.phone, content: successMsg });
      }
    } catch (payoutError) {
      console.error("Payout failed:", payoutError);
      await supabase
        .from("withdrawals")
        .update({ status: "failed" })
        .eq("id", withdrawal_id);

      return NextResponse.json(
        { error: "Payout failed. Please try again or contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
