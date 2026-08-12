import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Admin triggers a password-reset email for their partner.
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

    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (me?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { partner_email } = await request.json();
    if (!partner_email) {
      return NextResponse.json({ error: "partner_email required" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://geez-lac.vercel.app";

    // Use service role if available for reliable admin action
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey
      );
      const { error } = await admin.auth.resetPasswordForEmail(partner_email, {
        redirectTo: `${appUrl}/reset-password`,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Fallback: regular client (works if email is known)
      const { error } = await supabase.auth.resetPasswordForEmail(partner_email, {
        redirectTo: `${appUrl}/reset-password`,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
