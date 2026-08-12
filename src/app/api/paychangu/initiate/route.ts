import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initiatePayment } from "@/lib/paychangu";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, note, depositor_name, depositor_id, email, goal_id, platform } = body;

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Minimum amount is MWK 100" },
        { status: 400 }
      );
    }

    if (!depositor_name) {
      return NextResponse.json(
        { error: "Depositor name is required" },
        { status: 400 }
      );
    }

    const tx_ref = `GEEZ-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://geez-lac.vercel.app"
    ).replace(/\/$/, "");
    if (!appUrl.startsWith("http")) {
      throw new Error("NEXT_PUBLIC_APP_URL must be a valid http(s) URL");
    }

    const supabase = await createClient();

    const insertData: Record<string, unknown> = {
      tx_ref,
      amount,
      currency: "MWK",
      status: "pending",
      depositor_id: depositor_id || null,
      depositor_name,
      note: note || null,
    };

    // Only add goal_id if the column exists and a value is provided
    if (goal_id) {
      insertData.goal_id = goal_id;
    }

    const { error: dbError } = await supabase
      .from("transactions")
      .insert(insertData);

    if (dbError) {
      console.error("DB insert error:", dbError);
      // Continue even if DB insert fails (e.g. missing column) — payment can still proceed
    }

    const payment = await initiatePayment({
      amount,
      currency: "MWK",
      email: email || undefined,
      first_name: depositor_name.split(" ")[0] || depositor_name,
      last_name: depositor_name.split(" ").slice(1).join(" ") || undefined,
      tx_ref,
      callback_url: `${appUrl}/api/paychangu/webhook`,
      // PayChangu only accepts http(s) return URLs — never custom schemes
      return_url: `${appUrl.replace(/\/$/, "")}/deposit/return?tx_ref=${encodeURIComponent(tx_ref)}`,
      customization: {
        title: "GEEZ Savings",
        description: note || "Shared savings deposit",
      },
      meta: {
        depositor_name,
        depositor_id,
        note,
        goal_id: goal_id || null,
      },
    });

    return NextResponse.json({
      checkout_url: payment.data.checkout_url,
      tx_ref,
    });
  } catch (err) {
    console.error("Initiate payment error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Payment initiation failed",
      },
      { status: 500 }
    );
  }
}
