import { NextRequest, NextResponse } from "next/server";

/**
 * PayChangu often redirects back with POST (405 on a normal page).
 * Accept GET + POST here, then 303 redirect to the client return page.
 */
function buildRedirect(request: NextRequest) {
  const url = request.nextUrl;
  const txRef =
    url.searchParams.get("tx_ref") ||
    url.searchParams.get("txRef") ||
    url.searchParams.get("reference") ||
    "";

  const status =
    url.searchParams.get("status") ||
    url.searchParams.get("payment_status") ||
    "";

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://geez-lac.vercel.app"
  ).replace(/\/$/, "");

  const dest = new URL(`${appUrl}/deposit/return`);
  if (txRef) dest.searchParams.set("tx_ref", txRef);
  if (status) dest.searchParams.set("status", status);

  // Also forward any other useful query params
  url.searchParams.forEach((value, key) => {
    if (!dest.searchParams.has(key) && key !== "txRef") {
      dest.searchParams.set(key, value);
    }
  });

  return NextResponse.redirect(dest, 303);
}

export async function GET(request: NextRequest) {
  return buildRedirect(request);
}

export async function POST(request: NextRequest) {
  // PayChangu may send fields in the body instead of query string
  try {
    const contentType = request.headers.get("content-type") || "";
    let txRef = request.nextUrl.searchParams.get("tx_ref") || "";
    let status = request.nextUrl.searchParams.get("status") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      txRef = body.tx_ref || body.txRef || body.reference || txRef;
      status = body.status || body.payment_status || status;
    } else if (
      contentType.includes("form") ||
      contentType.includes("x-www-form-urlencoded")
    ) {
      const form = await request.formData().catch(() => null);
      if (form) {
        txRef =
          String(form.get("tx_ref") || form.get("txRef") || form.get("reference") || txRef);
        status = String(form.get("status") || form.get("payment_status") || status);
      }
    }

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "https://geez-lac.vercel.app"
    ).replace(/\/$/, "");

    const dest = new URL(`${appUrl}/deposit/return`);
    if (txRef) dest.searchParams.set("tx_ref", txRef);
    if (status) dest.searchParams.set("status", status);

    return NextResponse.redirect(dest, 303);
  } catch {
    return buildRedirect(request);
  }
}
