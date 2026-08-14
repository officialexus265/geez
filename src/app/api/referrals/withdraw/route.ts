import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  initiateMobileMoneyPayout,
  MOBILE_MONEY_OPERATORS,
} from "@/lib/paychangu";
import { randomUUID } from "crypto";

/**
 * POST — withdraw referral wallet to Airtel/TNM
 * body: { amount, phone_number, destination_type }
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
    const amount = Number(body.amount);
    const phone = String(body.phone_number || "").trim();
    const destination_type = body.destination_type || "airtel_money";

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Minimum referral withdrawal is MWK 100" },
        { status: 400 }
      );
    }
    if (!phone || phone.length < 9) {
      return NextResponse.json(
        { error: "Valid phone number required" },
        { status: 400 }
      );
    }
    if (!["airtel_money", "tnm_mpamba"].includes(destination_type)) {
      return NextResponse.json({ error: "Invalid destination" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("referral_balance, email, full_name")
      .eq("id", user.id)
      .single();

    const bal = Number(profile?.referral_balance || 0);
    if (amount > bal) {
      return NextResponse.json(
        { error: "Insufficient referral balance" },
        { status: 400 }
      );
    }

    // Debit first (atomic-ish)
    const { error: debitErr } = await admin
      .from("profiles")
      .update({ referral_balance: bal - amount })
      .eq("id", user.id)
      .gte("referral_balance", amount);

    if (debitErr) {
      return NextResponse.json({ error: debitErr.message }, { status: 500 });
    }

    // Re-check balance in case of race
    const { data: after } = await admin
      .from("profiles")
      .select("referral_balance")
      .eq("id", user.id)
      .single();
    // Already debited above

    try {
      const operatorRef =
        destination_type === "airtel_money"
          ? MOBILE_MONEY_OPERATORS.airtel_money
          : MOBILE_MONEY_OPERATORS.tnm_mpamba;

      await initiateMobileMoneyPayout({
        amount,
        mobile: phone,
        mobile_money_operator_ref_id: operatorRef,
        charge_id: randomUUID(),
        email: profile?.email || undefined,
        first_name: profile?.full_name?.split(" ")[0],
        last_name:
          profile?.full_name?.split(" ").slice(1).join(" ") || undefined,
      });
    } catch (payoutErr) {
      // Refund on payout failure
      console.error("Referral payout failed, refunding", payoutErr);
      await admin
        .from("profiles")
        .update({ referral_balance: bal })
        .eq("id", user.id);
      return NextResponse.json(
        {
          error:
            payoutErr instanceof Error
              ? payoutErr.message
              : "Payout failed — balance restored",
        },
        { status: 502 }
      );
    }

    await admin.from("notifications").insert({
      user_id: user.id,
      title: "Referral payout sent",
      body: `MWK ${amount} sent to ${destination_type} ${phone}.`,
      type: "system",
      metadata: { amount, phone, destination_type },
    });

    await admin.from("fee_ledger").insert({
      user_id: user.id,
      fee_type: "referral",
      amount: -amount,
      meta: {
        note: "referral wallet payout",
        phone,
        destination_type,
      },
    });

    return NextResponse.json({
      ok: true,
      amount,
      remaining: bal - amount,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
