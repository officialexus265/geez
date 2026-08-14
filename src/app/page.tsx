"use client";

import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Heart,
  ArrowRight,
  Shield,
  Sparkles,
  Share2,
  Download,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LandingContent() {
  const searchParams = useSearchParams();
  const autoDownload = searchParams.get("download") === "1";
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("app_settings")
          .select("apk_download_url, og_image_url, brand_name")
          .eq("id", "main")
          .maybeSingle();
        if (data?.apk_download_url) setApkUrl(data.apk_download_url);
      } catch {
        // ignore
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!autoDownload || !apkUrl) return;
    setDownloading(true);
    const t = setTimeout(() => {
      window.location.href = apkUrl;
      setDownloading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [autoDownload, apkUrl]);

  async function handleShare() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://geez-lac.vercel.app";
    const shareUrl = `${origin}/?download=1`;
    const shareData = {
      title: "GEEZ — Savings",
      text: "Save smarter with GEEZ. Open the link to get the app.",
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareHint("Shared");
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareHint("Link copied — paste it in WhatsApp or anywhere");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareHint("Link copied");
      } catch {
        setShareHint(shareUrl);
      }
    }
    setTimeout(() => setShareHint(null), 4000);
  }

  function handleDownload() {
    if (!apkUrl) {
      setShareHint("APK not uploaded yet — ask admin to upload in Settings");
      return;
    }
    setDownloading(true);
    window.location.href = apkUrl;
    setTimeout(() => setDownloading(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-love/10 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Heart className="h-5 w-5 fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight">GEEZ</span>
        </div>
        <Link
          href="/login"
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          Sign in
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-lg"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary"
          >
            <Heart className="h-10 w-10 fill-current" />
          </motion.div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Your{" "}
            <span className="text-primary">savings</span>
            <br />
            platform
          </h1>

          <p className="mb-10 text-lg text-muted-foreground">
            Personal or dual accounts. Goals, secure deposits, and more.
            <br />
            Powered by PayChangu.
          </p>

          {autoDownload && (
            <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
              {downloading || apkUrl ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting app download…
                </span>
              ) : (
                "Preparing download… If it doesn’t start, use Download app below."
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition hover:bg-primary-hover"
            >
              Enter GEEZ
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-8 py-3.5 text-base font-medium transition hover:bg-muted"
            >
              <Share2 className="h-4 w-4" />
              Share app
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Download className="h-4 w-4" />
            Download Android app
          </button>

          {shareHint && (
            <p className="mt-3 text-xs text-muted-foreground">{shareHint}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-16 flex flex-wrap justify-center gap-3"
        >
          {[
            { icon: Shield, label: "Secure deposits" },
            { icon: Sparkles, label: "Personal & dual" },
            { icon: Heart, label: "Goals that stick" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur"
            >
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-muted-foreground">
        GEEZ · Save with purpose
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LandingContent />
    </Suspense>
  );
}
