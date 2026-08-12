"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Heart,
  ArrowLeft,
  Code2,
  Shield,
  Smartphone,
  Cloud,
  Sparkles,
} from "lucide-react";

const VERSION = "1.0.0";
const BUILD = "2026.08.12";

const tech = [
  { icon: Code2, label: "Next.js + React", desc: "Modern web app" },
  { icon: Cloud, label: "Supabase", desc: "Auth, database & storage" },
  { icon: Shield, label: "PayChangu", desc: "Secure payments & payouts" },
  { icon: Smartphone, label: "PWA + Capacitor", desc: "Install on your phone" },
  { icon: Sparkles, label: "Framer Motion", desc: "Smooth animations" },
];

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">About</h1>
          <p className="text-sm text-muted-foreground">GEEZ shared savings</p>
        </div>
      </div>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-hover p-8 text-center text-primary-foreground shadow-xl"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
          <Heart className="h-8 w-8 fill-current" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">GEEZ</h2>
        <p className="mt-2 text-sm opacity-90">Our Shared Savings Vault</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-black/20 px-4 py-1.5 text-xs font-medium backdrop-blur">
          <span>Version {VERSION}</span>
          <span className="opacity-50">·</span>
          <span>Build {BUILD}</span>
        </div>
      </motion.section>

      {/* Story */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h3 className="font-semibold">Built with love</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          GEEZ is a private savings space for two people. Deposit together,
          track goals, and withdraw only with dual approval — so every decision
          is shared. Designed to feel playful, secure, and a little romantic.
        </p>
      </motion.section>

      {/* Version details */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h3 className="mb-3 font-semibold">App info</h3>
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">App name</dt>
            <dd className="font-medium">GEEZ</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-medium">{VERSION}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Build</dt>
            <dd className="font-medium">{BUILD}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Platform</dt>
            <dd className="font-medium">Web · PWA · Android</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Currency</dt>
            <dd className="font-medium">MWK (Malawi Kwacha)</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Payments</dt>
            <dd className="font-medium">PayChangu</dd>
          </div>
        </dl>
      </motion.section>

      {/* Tech */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
      >
        <h3 className="mb-3 font-semibold">Powered by</h3>
        <div className="space-y-2">
          {tech.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.label}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="pb-4 text-center text-xs text-muted-foreground"
      >
        Made with <Heart className="inline h-3 w-3 fill-primary text-primary" />{" "}
        for the two of you
        <br />
        © {new Date().getFullYear()} GEEZ
      </motion.p>
    </div>
  );
}
