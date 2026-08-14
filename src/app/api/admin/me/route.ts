import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const OWNER_EMAILS = ["officialnexus265@gmail.com"];

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ allowed: false, reason: "not_logged_in" });
    }

    const authEmail = (user.email || "").trim().toLowerCase();
    if (OWNER_EMAILS.includes(authEmail)) {
      return NextResponse.json({
        allowed: true,
        via: "owner_email",
        email: authEmail,
        userId: user.id,
      });
    }

    // Service role read — ignores RLS
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .maybeSingle();

      const role = String(profile?.role || "").trim().toLowerCase();
      const allowedRoles = ["super_admin", "admin", "finance"];
      if (allowedRoles.includes(role)) {
        return NextResponse.json({
          allowed: true,
          via: "role",
          role,
          email: profile?.email || authEmail,
          userId: user.id,
        });
      }

      return NextResponse.json({
        allowed: false,
        reason: "not_admin",
        role: role || null,
        email: authEmail,
        profileEmail: profile?.email || null,
        userId: user.id,
      });
    } catch (e) {
      // If service role missing, still allow owner email only (already checked)
      return NextResponse.json({
        allowed: false,
        reason: "profile_check_failed",
        email: authEmail,
        userId: user.id,
        error: e instanceof Error ? e.message : "error",
      });
    }
  } catch (err) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "error",
        error: err instanceof Error ? err.message : "error",
      },
      { status: 500 }
    );
  }
}
