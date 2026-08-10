import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateConfirmationCode, sendEmail, sendSMS } from "@/lib/notifications";

/**
 * POST /api/withdrawals
 * Start a withdrawal → generate code → send to partner
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
    const { amount, destination_type, phone_number } = body;

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Minimum withdrawal is MWK 100" },
        { status: 400 }
      );
    }

    if (!["airtel_money", "tnm_mpamba"].includes(destination_type)) {
      return NextResponse.json(
        { error: "Invalid destination" },
        { status: 400 }
      );
    }

    if (!phone_number) {
      return NextResponse.json(
        { error: "Phone number required" },
        { status: 400 }
      );
    }

    // Get current user profile + partner profile
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone, role")
      .order("created_at", { ascending: true });

    const me = profiles?.find((p) => p.id === user.id);
    const partner = profiles?.find((p) => p.id !== user.id);

    if (!me || !partner) {
      return NextResponse.json(
        { error: "Partner not found. Both accounts must exist." },
        { status: 400 }
      );
    }

    const code = generateConfirmationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    const { data: withdrawal, error } = await supabase
      .from("withdrawals")
      .insert({
        amount,
        currency: "MWK",
        destination_type,
        phone_number,
        status: "pending_confirmation",
        initiated_by: user.id,
        confirmation_code: code,
        code_expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to create withdrawal" },
        { status: 500 }
      );
    }

    // Notify partner
    const message = `GEEZ: ${me.full_name} requested a withdrawal of MWK ${amount}. Your confirmation code is ${code}. Valid for 15 minutes.`;

    if (partner.email) {
      await sendEmail({
        to: partner.email,
        subject: "GEEZ — Withdrawal confirmation code",
        html: `<p>${message}</p><p>If you did not expect this, contact your partner immediately.</p>`,
      });
    }

    if (partner.phone) {
      await sendSMS({ to: partner.phone, content: message });
    }

    return NextResponse.json({
      withdrawal_id: withdrawal.id,
      message: "Confirmation code sent to your partner",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
