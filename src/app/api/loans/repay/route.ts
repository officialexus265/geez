import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST — record loan repayment (from mobile money / marked paid)
 * body: { loan_id, amount }
 * For V1 of loans: user confirms they paid; balances updated.
 * Full PayChangu collect can be wired later.
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
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const remaining =
      Number(loan.total_repayable) - Number(loan.amount_repaid || 0);
    const applied = Math.min(pay, remaining);
    const newRepaid = Number(loan.amount_repaid || 0) + applied;
    const fullyPaid = newRepaid >= Number(loan.total_repayable) - 0.001;

    await admin
      .from("loans")
      .update({
        amount_repaid: newRepaid,
        status: fullyPaid ? "repaid" : "active",
      })
      .eq("id", loan.id);

    // Interest portion of this payment → 50% platform fee ledger, 50% to fixed goals proportional
    // Approximate: interest share of repayment
    const interestShare =
      Number(loan.interest_amount) / Number(loan.total_repayable);
    const interestPart = Math.round(applied * interestShare * 100) / 100;
    const half = Math.round((interestPart / 2) * 100) / 100;

    if (half > 0) {
      await admin.from("fee_ledger").insert({
        user_id: user.id,
        fee_type: "loan_interest",
        amount: half,
        meta: { loan_id: loan.id, note: "platform half of interest on repayment" },
      });

      const { data: fixedGoals } = await admin
        .from("goals")
        .select("id, current_amount")
        .or(`created_by.eq.${user.id},owner_id.eq.${user.id}`)
        .eq("goal_type", "fixed");

      const totalFixed = (fixedGoals || []).reduce(
        (s, g) => s + Number(g.current_amount || 0),
        0
      );
      if (fixedGoals && fixedGoals.length && totalFixed > 0) {
        for (const g of fixedGoals) {
          const share =
            (Number(g.current_amount) / totalFixed) * half;
          await admin
            .from("goals")
            .update({
              current_amount: Number(g.current_amount) + share,
              updated_at: new Date().toISOString(),
            })
            .eq("id", g.id);
        }
      } else if (half > 0) {
        // no fixed goals — credit general
        const { data: prof } = await admin
          .from("profiles")
          .select("general_balance")
          .eq("id", user.id)
          .single();
        if (prof) {
          await admin
            .from("profiles")
            .update({
              general_balance: Number(prof.general_balance || 0) + half,
            })
            .eq("id", user.id);
        }
      }
    }

    await admin.from("notifications").insert({
      user_id: user.id,
      title: fullyPaid ? "Loan fully repaid" : "Loan repayment recorded",
      body: `Payment of MWK ${applied} recorded.${fullyPaid ? " Loan closed." : ""}`,
      type: "system",
      metadata: { loan_id: loan.id, amount: applied },
    });

    return NextResponse.json({
      status: fullyPaid ? "repaid" : "active",
      amount_repaid: newRepaid,
      remaining: Math.max(0, Number(loan.total_repayable) - newRepaid),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
