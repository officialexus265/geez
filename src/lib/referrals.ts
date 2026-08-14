import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Credit referrer 1% of the referred user's FIRST successful deposit ever.
 * Paid from platform margin (ledger only — does not reduce depositor amount).
 */
export async function maybeCreditReferral(
  admin: SupabaseClient,
  depositorId: string | null | undefined,
  depositAmount: number,
  txRef: string
) {
  if (!depositorId || !depositAmount || depositAmount <= 0) return null;

  // Only first successful deposit for this user
  const { count } = await admin
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("depositor_id", depositorId)
    .eq("status", "success");

  // count includes the one we just marked success — first means count === 1
  if ((count ?? 0) !== 1) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, referred_by, full_name")
    .eq("id", depositorId)
    .single();

  if (!profile?.referred_by) return null;

  // Already paid for this referred user?
  const { data: existing } = await admin
    .from("referral_earnings")
    .select("id")
    .eq("referred_id", depositorId)
    .limit(1);

  if (existing && existing.length) return null;

  const earning = Math.round(depositAmount * 0.01 * 100) / 100;
  if (earning <= 0) return null;

  await admin.from("referral_earnings").insert({
    referrer_id: profile.referred_by,
    referred_id: depositorId,
    deposit_tx_ref: txRef,
    deposit_amount: depositAmount,
    earning_amount: earning,
  });

  const { data: referrer } = await admin
    .from("profiles")
    .select("referral_balance")
    .eq("id", profile.referred_by)
    .single();

  if (referrer) {
    await admin
      .from("profiles")
      .update({
        referral_balance: Number(referrer.referral_balance || 0) + earning,
      })
      .eq("id", profile.referred_by);
  }

  await admin.from("fee_ledger").insert({
    user_id: profile.referred_by,
    fee_type: "referral",
    amount: earning,
    meta: {
      note: "platform margin cost for referral reward",
      referred_id: depositorId,
      tx_ref: txRef,
    },
  });

  await admin.from("notifications").insert({
    user_id: profile.referred_by,
    title: "Referral reward 🎉",
    body: `You earned MWK ${earning.toFixed(0)} (1% of a first deposit).`,
    type: "system",
    metadata: { earning, referred_id: depositorId, tx_ref: txRef },
  });

  return { referrer_id: profile.referred_by, earning };
}
