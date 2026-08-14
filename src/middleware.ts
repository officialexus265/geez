import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // PayChangu POST → page would 405. Force GET to same path (query kept).
  if (
    request.method === "POST" &&
    (path === "/deposit/return" || path.startsWith("/deposit/return/"))
  ) {
    const base = (
      process.env.NEXT_PUBLIC_APP_URL || "https://geez-lac.vercel.app"
    ).replace(/\/$/, "");
    const dest = new URL(path, base);
    request.nextUrl.searchParams.forEach((v, k) => dest.searchParams.set(k, v));
    return NextResponse.redirect(dest.toString(), 303);
  }

  // Never run auth logic on payment / public deposit paths
  if (
    path.startsWith("/deposit") ||
    path.startsWith("/api/paychangu") ||
    path === "/"
  ) {
    return NextResponse.next();
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isAppRoute =
      path.startsWith("/dashboard") ||
      path.startsWith("/history") ||
      path.startsWith("/goals") ||
      path.startsWith("/withdraw") ||
      path.startsWith("/profile") ||
      path.startsWith("/settings") ||
      path.startsWith("/receipt") ||
      path.startsWith("/about") ||
      path.startsWith("/chat") ||
      path.startsWith("/admin") ||
      path.startsWith("/dual") ||
      path.startsWith("/loans") ||
      path.startsWith("/referrals");

    const isAuthRoute =
      path.startsWith("/login") ||
      path.startsWith("/register") ||
      path.startsWith("/forgot-password") ||
      path.startsWith("/reset-password");

    if (isAppRoute && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }

    if (isAuthRoute && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (err) {
    console.error("Middleware error:", err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/history/:path*",
    "/goals/:path*",
    "/withdraw/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/receipt/:path*",
    "/about",
    "/chat",
    "/admin/:path*",
    "/dual/:path*",
    "/loans",
    "/loans/:path*",
    "/referrals",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/deposit/return",
    "/deposit/return/:path*",
  ],
};
