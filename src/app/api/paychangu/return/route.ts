import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PayChangu return endpoint — accepts GET and POST.
 * Always responds with 303 redirect to the success UI (GET only).
 */
function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL || "https://geez-lac.vercel.app"
  ).replace(/\/$/, "");
}

async function extractTxRef(request: NextRequest): Promise<{
  txRef: string;
  status: string;
}> {
  const url = request.nextUrl;
  let txRef =
    url.searchParams.get("tx_ref") ||
    url.searchParams.get("txRef") ||
    url.searchParams.get("reference") ||
    url.searchParams.get("data[tx_ref]") ||
    "";
  let status =
    url.searchParams.get("status") ||
    url.searchParams.get("payment_status") ||
    "";

  if (request.method === "POST") {
    try {
      const ct = request.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await request.json().catch(() => ({} as any));
        txRef =
          body?.tx_ref ||
          body?.txRef ||
          body?.reference ||
          body?.data?.tx_ref ||
          txRef;
        status = body?.status || body?.payment_status || status;
      } else {
        const form = await request.formData().catch(() => null);
        if (form) {
          txRef = String(
            form.get("tx_ref") ||
              form.get("txRef") ||
              form.get("reference") ||
              txRef
          );
          status = String(
            form.get("status") || form.get("payment_status") || status
          );
        }
      }
    } catch {
      // keep query values
    }
  }

  return { txRef, status };
}

async function handle(request: NextRequest) {
  const { txRef, status } = await extractTxRef(request);
  const dest = new URL(`${appBase()}/deposit/return`);
  if (txRef) dest.searchParams.set("tx_ref", txRef);
  if (status) dest.searchParams.set("status", status);

  // Absolute URL + 303 forces GET in all browsers
  return NextResponse.redirect(dest.toString(), 303);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// Some gateways probe with HEAD
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
