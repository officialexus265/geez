import type { SupabaseClient } from "@supabase/supabase-js";

/** Apply repayment after successful PayChangu payment */
export async function applyLoanRepayment(
  admin: SupabaseClient,
  loanId: string,
  amount: number,
  userId: string
) {
  const { data: loan } = await admin
    .from("loans")
    .select("*")
    .eq("id", loanId)
    .eq("user_id", userId)
    .single();

  if (!loan || loan.status !== "active") return;

  const remaining =
    Number(loan.total_repayable) - Number(loan.amount_repaid || 0);
  const applied = Math.min(amount, remaining);
  const newRepaid = Number(loan.amount_repaid || 0) + applied;
  const fullyPaid = newRepaid >= Number(loan.total_repayable) - 0.001;

  await admin
    .from("loans")
    .update({
      amount_repaid: newRepaid,
      status: fullyPaid ? "repaid" : "active",
    })
    .eq("id", loan.id);

  const interestShare =
    Number(loan.interest_amount) / Number(loan.total_repayable) || 0;
  const interestPart = Math.round(applied * interestShare * 100) / 100;
  const half = Math.round((interestPart / 2) * 100) / 100;

  if (half > 0) {
    await admin.from("fee_ledger").insert({
      user_id: userId,
      fee_type: "loan_interest",
      amount: half,
      meta: { loan_id: loan.id, note: "platform half of interest on repayment" },
    });

    const { data: fixedGoals } = await admin
      .from("goals")
      .select("id, current_amount")
      .or(`created_by.eq.${userId},owner_id.eq.${userId}`)
      .eq("goal_type", "fixed");

    const totalFixed = (fixedGoals || []).reduce(
      (s, g) => s + Number(g.current_amount || 0),
      0
    );
    if (fixedGoals && fixedGoals.length && totalFixed > 0) {
      for (const g of fixedGoals) {
        const share = (Number(g.current_amount) / totalFixed) * half;
        await admin
          .from("goals")
          .update({
            current_amount: Number(g.current_amount) + share,
            updated_at: new Date().toISOString(),
          })
          .eq("id", g.id);
      }
    }
  }

  await admin.from("notifications").insert({
    user_id: userId,
    title: fullyPaid ? "Loan fully repaid" : "Loan repayment received",
    body: `Payment of MWK ${applied} applied to your loan.`,
    type: "system",
    metadata: { loan_id: loan.id, amount: applied },
  });
}
