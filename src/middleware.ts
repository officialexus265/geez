import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // PayChangu often POSTs back to return_url → 405 on a page route.
  // Convert POST → GET redirect so the success screen loads.
  if (
    request.method === "POST" &&
    (path === "/deposit/return" ||
      path.startsWith("/deposit/return") ||
      path === "/api/paychangu/return")
  ) {
    const url = request.nextUrl.clone();
    // 303 See Other forces the browser to follow with GET
    return NextResponse.redirect(url, 303);
  }

  // Skip auth logic for payment return paths
  if (
    path.startsWith("/deposit/return") ||
    path.startsWith("/api/paychangu")
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
      path.startsWith("/chat");

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
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/deposit/return",
    "/deposit/return/:path*",
    "/api/paychangu/return",
  ],
};
