import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiatePayment } from "@/lib/paychangu";
import { randomUUID } from "crypto";

/**
 * POST — start real PayChangu payment to repay a loan.
 * Loan is only marked repaid after webhook/verify with meta.loan_repay_id
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

    const { loan_id, amount } = await request.json();
    const pay = Number(amount);
    if (!loan_id || !pay || pay <= 0) {
      return NextResponse.json({ error: "Invalid repayment" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: loan } = await admin
      .from("loans")
      .select("*")
      .eq("id", loan_id)
      .eq("user_id", user.id)
      .single();

    if (!loan || loan.status !== "active") {
      return NextResponse.json({ error: "Loan not found or not active" }, { status: 404 });
    }

    const remaining =
      Number(loan.total_repayable) - Number(loan.amount_repaid || 0);
    const applied = Math.min(pay, remaining);
    if (applied < 100) {
      return NextResponse.json(
        { error: "Minimum repayment is MWK 100" },
        { status: 400 }
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();

    const tx_ref = `GEEZ-LOAN-${loan.id.slice(0, 8)}-${Date.now()}`;
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "https://geez-lac.vercel.app"
    ).replace(/\/$/, "");

    await admin.from("transactions").insert({
      tx_ref,
      amount: applied,
      currency: "MWK",
      status: "pending",
      depositor_id: user.id,
      depositor_name: profile?.full_name || "Loan repayment",
      note: `Loan repayment ${loan.id}`,
    });

    const payment = await initiatePayment({
      amount: applied,
      currency: "MWK",
      email: profile?.email || undefined,
      first_name: profile?.full_name?.split(" ")[0],
      last_name: profile?.full_name?.split(" ").slice(1).join(" ") || undefined,
      tx_ref,
      callback_url: `${appUrl}/api/paychangu/webhook`,
      return_url: `${appUrl}/api/paychangu/return?tx_ref=${encodeURIComponent(tx_ref)}`,
      customization: {
        title: "GEEZ Loan repayment",
        description: `Repay loan ${loan.id.slice(0, 8)}`,
      },
      meta: {
        type: "loan_repay",
        loan_id: loan.id,
        amount: applied,
        depositor_id: user.id,
      },
    });

    const checkout =
      payment?.data?.checkout_url ||
      payment?.data?.data?.checkout_url ||
      payment?.checkout_url;

    return NextResponse.json({
      checkout_url: checkout,
      tx_ref,
      amount: applied,
      message: "Complete payment on PayChangu to repay the loan",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
