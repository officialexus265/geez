import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET — list my loans + eligibility snapshot
 * POST — request loan (automated approval if eligible)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: settings } = await admin
      .from("app_settings")
      .select("loans_enabled, loan_interest_percent, loan_duration_days")
      .eq("id", "main")
      .maybeSingle();

    const loansEnabled = !!settings?.loans_enabled;
    const interestPercent = Number(settings?.loan_interest_percent ?? 25);
    const durationDays = Number(settings?.loan_duration_days ?? 60);

    const { data: goals } = await admin
      .from("goals")
      .select("current_amount, goal_type")
      .or(`created_by.eq.${user.id},owner_id.eq.${user.id}`)
      .eq("goal_type", "fixed");

    const fixedTotal = (goals || []).reduce(
      (s, g) => s + Number(g.current_amount || 0),
      0
    );

    const { data: loans } = await admin
      .from("loans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const open = (loans || []).filter((l) => l.status === "active");
    const openObligation = open.reduce(
      (s, l) => s + (Number(l.total_repayable) - Number(l.amount_repaid || 0)),
      0
    );
    const maxBorrowable = Math.max(0, fixedTotal - openObligation);

    return NextResponse.json({
      loans_enabled: loansEnabled,
      interest_percent: interestPercent,
      duration_days: durationDays,
      fixed_total: fixedTotal,
      open_obligation: openObligation,
      max_borrowable: maxBorrowable,
      loans: loans || [],
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

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
    const principal = Number(body.amount);
    const phone = String(body.phone_number || "").trim();
    const destination_type = body.destination_type || "airtel_money";

    if (!principal || principal < 100) {
      return NextResponse.json(
        { error: "Minimum loan is MWK 100" },
        { status: 400 }
      );
    }
    if (!phone || phone.length < 9) {
      return NextResponse.json(
        { error: "Valid payout phone required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: settings } = await admin
      .from("app_settings")
      .select("loans_enabled, loan_interest_percent, loan_duration_days")
      .eq("id", "main")
      .maybeSingle();

    if (!settings?.loans_enabled) {
      return NextResponse.json(
        { error: "Loans are currently unavailable (coming soon)" },
        { status: 403 }
      );
    }

    const interestPercent = Number(settings.loan_interest_percent ?? 25);
    const durationDays = Number(settings.loan_duration_days ?? 60);
    const interestAmount =
      Math.round(principal * (interestPercent / 100) * 100) / 100;
    const totalRepayable =
      Math.round((principal + interestAmount) * 100) / 100;

    const { data: goals } = await admin
      .from("goals")
      .select("current_amount, goal_type")
      .or(`created_by.eq.${user.id},owner_id.eq.${user.id}`)
      .eq("goal_type", "fixed");

    const fixedTotal = (goals || []).reduce(
      (s, g) => s + Number(g.current_amount || 0),
      0
    );

    if (fixedTotal <= 0) {
      return NextResponse.json(
        {
          error:
            "Create a fixed savings goal and deposit into it before requesting a loan",
        },
        { status: 400 }
      );
    }

    const { data: openLoans } = await admin
      .from("loans")
      .select("total_repayable, amount_repaid, status")
      .eq("user_id", user.id)
      .eq("status", "active");

    const openObligation = (openLoans || []).reduce(
      (s, l) => s + (Number(l.total_repayable) - Number(l.amount_repaid || 0)),
      0
    );

    if (openObligation + totalRepayable > fixedTotal + 0.001) {
      return NextResponse.json(
        {
          error: `Loan plus interest would exceed your fixed savings. Max available ~ MWK ${Math.max(0, fixedTotal - openObligation).toFixed(0)}`,
        },
        { status: 400 }
      );
    }

    const due = new Date();
    due.setDate(due.getDate() + durationDays);

    const { data: loan, error } = await admin
      .from("loans")
      .insert({
        user_id: user.id,
        principal,
        interest_percent: interestPercent,
        interest_amount: interestAmount,
        total_repayable: totalRepayable,
        amount_repaid: 0,
        status: "active",
        disbursed_at: new Date().toISOString(),
        due_at: due.toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record intended payout details on notifications for admin visibility
    await admin.from("notifications").insert({
      user_id: user.id,
      title: "Loan disbursed",
      body: `MWK ${principal} loan approved. Repay MWK ${totalRepayable} by ${due.toLocaleDateString()}. Payout to ${destination_type} ${phone}.`,
      type: "system",
      metadata: {
        loan_id: loan.id,
        phone,
        destination_type,
        principal,
        total_repayable: totalRepayable,
      },
    });

    return NextResponse.json({
      loan,
      message: "Loan approved automatically",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
