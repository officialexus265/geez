import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyPayment } from "@/lib/paychangu";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tx_ref } = body;

    if (!tx_ref) {
      return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
    }

    const verification = await verifyPayment(tx_ref);
    const status = verification?.data?.status;

    const supabase = await createClient();

    if (status === "success") {
      const { data: tx, error } = await supabase
        .from("transactions")
        .update({
          status: "success",
          paychangu_data: verification.data,
          payment_method:
            verification?.data?.authorization?.channel
              ?.toLowerCase()
              ?.replace(" ", "_") || null,
          updated_at: new Date().toISOString(),
        })
        .eq("tx_ref", tx_ref)
        .select()
        .single();

      if (error) {
        console.error("Update error:", error);
      }

      // If linked to a goal, increase current_amount
      if (tx && (tx as any).goal_id) {
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

      return NextResponse.json({
        status: "success",
        transaction: tx,
      });
    }

    if (status === "failed" || status === "cancelled") {
      await supabase
        .from("transactions")
        .update({
          status: status === "cancelled" ? "cancelled" : "failed",
          paychangu_data: verification.data,
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
