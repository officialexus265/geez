import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayment } from "@/lib/paychangu";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tx_ref } = body;

    if (!tx_ref) {
      return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
    }

    const verification = await verifyPayment(tx_ref);
    // PayChangu may nest status differently
    const status =
      verification?.data?.status ||
      verification?.status ||
      verification?.data?.data?.status;

    const supabase = createAdminClient();

    if (status === "success" || status === "successful") {
      const { data: existing } = await supabase
        .from("transactions")
        .select("*")
        .eq("tx_ref", tx_ref)
        .maybeSingle();

      let tx = existing;

      if (existing) {
        if (existing.status !== "success") {
          const { data: updated, error } = await supabase
            .from("transactions")
            .update({
              status: "success",
              paychangu_data: verification.data ?? verification,
              payment_method:
                verification?.data?.authorization?.channel
                  ?.toLowerCase()
                  ?.replace(" ", "_") || null,
              updated_at: new Date().toISOString(),
            })
            .eq("tx_ref", tx_ref)
            .select()
            .single();

          if (error) console.error("Update error:", error);
          else tx = updated;
        }
      } else {
        // Row missing (insert failed earlier) — create from verification
        const amount = Number(
          verification?.data?.amount || verification?.data?.data?.amount || 0
        );
        const { data: created, error } = await supabase
          .from("transactions")
          .insert({
            tx_ref,
            amount,
            currency: "MWK",
            status: "success",
            depositor_name:
              verification?.data?.first_name ||
              verification?.data?.customer?.name ||
              "Deposit",
            paychangu_data: verification.data ?? verification,
          })
          .select()
          .single();
        if (error) console.error("Insert error:", error);
        else tx = created;
      }

      // Bump goal once when first marked success
      if (tx && (tx as any).goal_id && existing?.status !== "success") {
        const { data: goal } = await supabase
          .from("goals")
          .select("id, current_amount, target_amount")
          .eq("id", (tx as any).goal_id)
          .single();

        if (goal) {
          const newAmount = Number(goal.current_amount) + Number(tx.amount);
          await supabase
            .from("goals")
            .update({
              current_amount: newAmount,
              is_completed: newAmount >= Number(goal.target_amount),
              updated_at: new Date().toISOString(),
            })
            .eq("id", goal.id);
        }
      }

      return NextResponse.json({ status: "success", transaction: tx });
    }

    if (status === "failed" || status === "cancelled") {
      await supabase
        .from("transactions")
        .update({
          status: status === "cancelled" ? "cancelled" : "failed",
          paychangu_data: verification.data ?? verification,
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
