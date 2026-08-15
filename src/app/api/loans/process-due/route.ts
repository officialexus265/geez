import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Process overdue loans: deduct remaining from fixed goals (proportional),
 * split interest 50/50 platform vs fixed goals, mark defaulted.
 * Safe to call repeatedly (only status=active and due_at < now).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const q = request.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && q !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: overdue, error } = await admin
      .from("loans")
      .select("*")
      .eq("status", "active")
      .lt("due_at", now);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results: { id: string; action: string }[] = [];

    for (const loan of overdue || []) {
      const remaining =
        Number(loan.total_repayable) - Number(loan.amount_repaid || 0);
      if (remaining <= 0) {
        await admin
          .from("loans")
          .update({ status: "repaid" })
          .eq("id", loan.id);
        results.push({ id: loan.id, action: "marked_repaid" });
        continue;
      }

      const { data: fixedGoals } = await admin
        .from("goals")
        .select("id, current_amount")
        .or(`created_by.eq.${loan.user_id},owner_id.eq.${loan.user_id}`)
        .eq("goal_type", "fixed");

      let left = remaining;
      const totalFixed = (fixedGoals || []).reduce(
        (s, g) => s + Number(g.current_amount || 0),
        0
      );

      if (fixedGoals && fixedGoals.length && totalFixed > 0) {
        for (const g of fixedGoals) {
          if (left <= 0) break;
          const bal = Number(g.current_amount || 0);
          const take = Math.min(bal, left * (bal / totalFixed));
          // simpler proportional take of remaining
        }
        // Second pass: proportional deduction of full remaining
        for (const g of fixedGoals) {
          const bal = Number(g.current_amount || 0);
          const share = (bal / totalFixed) * remaining;
          const deduct = Math.min(bal, share);
          await admin
            .from("goals")
            .update({
              current_amount: bal - deduct,
              updated_at: new Date().toISOString(),
            })
            .eq("id", g.id);
        }
      }

      // Interest half to platform, half back to fixed (of the interest portion of remaining)
      const interestRatio =
        Number(loan.interest_amount) / Number(loan.total_repayable) || 0;
      const interestPart = remaining * interestRatio;
      const half = Math.round((interestPart / 2) * 100) / 100;

      if (half > 0) {
        await admin.from("fee_ledger").insert({
          user_id: loan.user_id,
          fee_type: "loan_interest",
          amount: half,
          meta: { loan_id: loan.id, reason: "default_platform_share" },
        });

        const { data: goalsAfter } = await admin
          .from("goals")
          .select("id, current_amount")
          .or(`created_by.eq.${loan.user_id},owner_id.eq.${loan.user_id}`)
          .eq("goal_type", "fixed");
        const tf = (goalsAfter || []).reduce(
          (s, g) => s + Number(g.current_amount || 0),
          0
        );
        if (goalsAfter && goalsAfter.length && tf > 0) {
          for (const g of goalsAfter) {
            const add = (Number(g.current_amount) / tf) * half;
            await admin
              .from("goals")
              .update({
                current_amount: Number(g.current_amount) + add,
                updated_at: new Date().toISOString(),
              })
              .eq("id", g.id);
          }
        }
      }

      await admin
        .from("loans")
        .update({
          status: "defaulted",
          amount_repaid: Number(loan.total_repayable),
        })
        .eq("id", loan.id);

      await admin.from("notifications").insert({
        user_id: loan.user_id,
        title: "Loan defaulted",
        body: `Your loan was not repaid on time. MWK ${remaining.toFixed(0)} was deducted from your fixed savings goals.`,
        type: "system",
        metadata: { loan_id: loan.id, deducted: remaining },
      });

      results.push({ id: loan.id, action: "defaulted" });
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
