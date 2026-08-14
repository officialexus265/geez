"use client";

import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";
import { Heart, WifiOff, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { useHideBalance } from "@/hooks/use-hide-balance";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import {
  isMemberOnlyPath,
  isStaffAccount,
} from "@/lib/staff";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const online = useOnline();
  const { hidden, toggle } = useHideBalance();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("app_settings")
          .select("logo_url")
          .eq("id", "main")
          .single();
        if (data?.logo_url) setLogoUrl(data.logo_url);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, email")
            .eq("id", user.id)
            .maybeSingle();
          const staff = isStaffAccount(
            profile?.role,
            profile?.email || user.email
          );
          setIsStaff(staff);

          // Staff never use member money routes
          if (staff && pathname && isMemberOnlyPath(pathname)) {
            router.replace("/admin");
            return;
          }
        }
      } catch {
        /* ignore */
      } finally {
        setReady(true);
      }
    }
    load();
  }, [pathname, router]);

  function handleRefresh() {
    try {
      router.refresh();
      router.replace(pathname || (isStaff ? "/admin" : "/dashboard"));
    } catch {
      router.push(isStaff ? "/admin" : "/dashboard");
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {!online && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-white">
          <WifiOff className="h-4 w-4" />
          You&apos;re offline — some features may not work
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link
            href={isStaff ? "/admin" : "/dashboard"}
            className="flex items-center gap-2"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="GEEZ"
                className="h-8 w-8 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Heart className="h-4 w-4 fill-current" />
              </div>
            )}
            <span className="font-bold tracking-tight">
              GEEZ{isStaff ? " Admin" : ""}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {!isStaff && (
              <button
                type="button"
                onClick={toggle}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted"
                title={hidden ? "Show balances" : "Hide balances"}
              >
                {hidden ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>

      <BottomNav isStaff={isStaff} />
    </div>
  );
}
