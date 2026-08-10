/**
 * PayChangu API helpers
 * Docs: https://developer.paychangu.com
 */

const PAYCHANGU_BASE = "https://api.paychangu.com";

export interface InitiatePaymentParams {
  amount: number;
  currency?: "MWK";
  email?: string;
  first_name: string;
  last_name?: string;
  tx_ref: string;
  callback_url: string;
  return_url: string;
  customization?: {
    title?: string;
    description?: string;
  };
  meta?: Record<string, unknown>;
}

export interface InitiatePaymentResponse {
  message: string;
  status: string;
  data: {
    event: string;
    checkout_url: string;
    data: {
      tx_ref: string;
      currency: string;
      amount: number;
      mode: string;
      status: string;
    };
  };
}

export async function initiatePayment(
  params: InitiatePaymentParams
): Promise<InitiatePaymentResponse> {
  const secretKey = process.env.PAYCHANGU_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYCHANGU_SECRET_KEY is not configured");
  }

  const res = await fetch(`${PAYCHANGU_BASE}/payment`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify({
      amount: String(params.amount),
      currency: params.currency || "MWK",
      email: params.email,
      first_name: params.first_name,
      last_name: params.last_name || "",
      tx_ref: params.tx_ref,
      callback_url: params.callback_url,
      return_url: params.return_url,
      customization: params.customization || {
        title: "GEEZ Savings Deposit",
        description: "Shared savings contribution",
      },
      meta: params.meta,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayChangu initiate failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function verifyPayment(txRef: string) {
  const secretKey = process.env.PAYCHANGU_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYCHANGU_SECRET_KEY is not configured");
  }

  const res = await fetch(
    `${PAYCHANGU_BASE}/verify-payment/${encodeURIComponent(txRef)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayChangu verify failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Verify webhook signature (HMAC SHA-256)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  const secret = process.env.PAYCHANGU_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  // Node crypto
  const crypto = require("crypto");
  const computed = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return computed === signature;
}

export interface MobileMoneyPayoutParams {
  amount: number;
  mobile: string;
  mobile_money_operator_ref_id: string;
  charge_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export async function initiateMobileMoneyPayout(
  params: MobileMoneyPayoutParams
) {
  const secretKey = process.env.PAYCHANGU_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYCHANGU_SECRET_KEY is not configured");
  }

  const res = await fetch(
    `${PAYCHANGU_BASE}/mobile-money/payouts/initialize`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        amount: String(params.amount),
        mobile: params.mobile,
        mobile_money_operator_ref_id: params.mobile_money_operator_ref_id,
        charge_id: params.charge_id,
        email: params.email,
        first_name: params.first_name,
        last_name: params.last_name,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayChangu payout failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Known operator ref_ids — fetch live via API in production */
export const MOBILE_MONEY_OPERATORS = {
  airtel_money: "20be6c20-adeb-4b5b-a7ba-0769820df4fb", // example — replace with live
  tnm_mpamba: "replace-with-real-tnm-ref-id",
} as const;
