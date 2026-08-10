"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Heart, ArrowRight, Shield, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Subtle background glow */}
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
            Our shared{" "}
            <span className="text-primary">savings</span>
            <br />
            vault
          </h1>

          <p className="mb-10 text-lg text-muted-foreground">
            Deposit together. Grow together.
            <br />
            Powered by PayChangu — built with love.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition hover:bg-primary-hover"
            >
              Enter GEEZ
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/deposit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-8 py-3.5 text-base font-medium transition hover:bg-muted"
            >
              Public Deposit
            </Link>
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="mt-16 flex flex-wrap justify-center gap-3"
        >
          {[
            { icon: Shield, label: "Secure dual-approval" },
            { icon: Sparkles, label: "Beautiful receipts" },
            { icon: Heart, label: "Built for two" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur"
            >
              <item.icon className="h-4 w-4 text-primary" />
              {item.label}
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="relative z-10 py-6 text-center text-sm text-muted-foreground">
        Made with <Heart className="inline h-3.5 w-3.5 fill-love text-love" /> for us
      </footer>
    </div>
  );
}
