import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { HideBalanceProvider } from "@/components/providers/hide-balance-provider";
import { SplashScreen } from "@/components/splash-screen";
import { DeepLinkHandler } from "@/components/deep-link-handler";
import { ForceUpdateGate } from "@/components/force-update-gate";
import { ClearStaleCache } from "@/components/clear-stale-cache";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://geez-lac.vercel.app";

async function getBranding(): Promise<{
  app_name?: string | null;
  og_image_url?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
} | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/app_settings?id=eq.main&select=app_name,og_image_url,logo_url,favicon_url`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) {
      console.error("Branding fetch failed", res.status, await res.text());
      return null;
    }
    const rows = await res.json();
    return rows?.[0] || null;
  } catch (e) {
    console.error("Branding fetch error", e);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  const title = branding?.app_name
    ? `${branding.app_name} — Savings`
    : "GEEZ — Savings";
  const description =
    "Personal and dual savings. Goals, secure PayChangu deposits, and more.";

  let ogImage =
    branding?.og_image_url ||
    branding?.logo_url ||
    `${APP_URL}/icons/icon-512.png`;

  if (ogImage.startsWith("/")) {
    ogImage = `${APP_URL}${ogImage}`;
  }

  const fbAppId = process.env.NEXT_PUBLIC_FB_APP_ID?.trim();

  return {
    title: {
      default: title,
      template: "%s · GEEZ",
    },
    description,
    applicationName: branding?.app_name || "GEEZ",
    manifest: "/manifest.json",
    metadataBase: new URL(APP_URL),
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: branding?.app_name || "GEEZ",
    },
    openGraph: {
      type: "website",
      locale: "en_MW",
      url: APP_URL,
      siteName: branding?.app_name || "GEEZ",
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: branding?.app_name || "GEEZ",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    icons: branding?.favicon_url
      ? { icon: branding.favicon_url }
      : undefined,
    other: fbAppId ? { "fb:app_id": fbAppId } : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4a6741" },
    { media: "(prefers-color-scheme: dark)", color: "#9b2335" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <ClearStaleCache />
          <SplashScreen />
          <DeepLinkHandler />
          <ForceUpdateGate>
            <HideBalanceProvider>{children}</HideBalanceProvider>
          </ForceUpdateGate>
        </ThemeProvider>
        {/* Service worker disabled — was caching old landing page in Capacitor WebView */}
      </body>
    </html>
  );
}
