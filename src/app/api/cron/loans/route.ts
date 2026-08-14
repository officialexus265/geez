import { NextRequest, NextResponse } from "next/server";

/**
 * Daily cron: loan reminders + process overdue defaults.
 * Protect with CRON_SECRET (Vercel sends Authorization: Bearer <CRON_SECRET>
 * or use ?secret= for manual test).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const q = request.nextUrl.searchParams.get("secret");

  if (secret) {
    const ok =
      auth === `Bearer ${secret}` || q === secret;
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://geez-lac.vercel.app";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  try {
    const [reminders, processDue] = await Promise.all([
      fetch(`${base}/api/loans/reminders`, {
        method: "POST",
        headers,
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) })),
      fetch(`${base}/api/loans/process-due`, {
        method: "POST",
        headers,
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) })),
    ]);

    return NextResponse.json({
      ok: true,
      reminders,
      processDue,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Cron loans error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 }
    );
  }
}
