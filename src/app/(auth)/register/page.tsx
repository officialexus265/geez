"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Heart,
  Mail,
  Lock,
  User,
  Loader2,
  Eye,
  EyeOff,
  Users,
  UserRound,
  Phone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Suspense } from "react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteFromUrl = searchParams.get("invite") || "";
  const refFromUrl = searchParams.get("ref") || "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<"personal" | "dual">(
    inviteFromUrl ? "dual" : "personal"
  );
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [referralUsername, setReferralUsername] = useState("");
  const [referredByCode, setReferredByCode] = useState(refFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required");
      setLoading(false);
      return;
    }

    if (accountType === "dual" && !inviteCode.trim()) {
      // Creating a new dual pair after signup is OK — empty invite means "I'll invite partner later"
    }

    const supabase = createClient();

    // Block duplicate phone at signup (best-effort client check)
    const { data: existingPhone } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone.trim())
      .maybeSingle();
    if (existingPhone) {
      setError("This phone number is already registered");
      setLoading(false);
      return;
    }

    if (referralUsername.trim()) {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("referral_username", referralUsername.trim().toLowerCase())
        .maybeSingle();
      if (taken) {
        setError("That referral username is taken");
        setLoading(false);
        return;
      }
    }

    const { data: signData, error: signError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: "member",
          phone: phone.trim(),
          account_type: accountType,
        },
      },
    });

    if (signError) {
      setError(signError.message);
      setLoading(false);
      return;
    }

    const userId = signData.user?.id;
    if (userId) {
      const updates: Record<string, unknown> = {
        full_name: fullName,
        phone: phone.trim(),
        account_type: accountType,
        role: "member",
      };
      if (referralUsername.trim()) {
        updates.referral_username = referralUsername.trim().toLowerCase();
      }

      // Resolve referrer by username
      if (referredByCode.trim()) {
        const { data: ref } = await supabase
          .from("profiles")
          .select("id")
          .eq("referral_username", referredByCode.trim().toLowerCase())
          .maybeSingle();
        if (ref) updates.referred_by = ref.id;
      }

      await supabase.from("profiles").update(updates).eq("id", userId);

      // Join dual via invite code
      if (accountType === "dual" && inviteCode.trim()) {
        const code = inviteCode.trim().toUpperCase();
        const { data: pair } = await supabase
          .from("dual_pairs")
          .select("*")
          .eq("invite_code", code)
          .eq("status", "pending")
          .maybeSingle();

        if (pair && pair.created_by !== userId && !pair.partner_id) {
          await supabase
            .from("dual_pairs")
            .update({
              partner_id: userId,
              status: "active",
              activated_at: new Date().toISOString(),
            })
            .eq("id", pair.id);

          await supabase
            .from("profiles")
            .update({ dual_pair_id: pair.id, account_type: "dual" })
            .eq("id", userId);

          await supabase
            .from("profiles")
            .update({ dual_pair_id: pair.id, account_type: "dual" })
            .eq("id", pair.created_by);
        }
      }
    }

    router.push(accountType === "dual" ? "/dual/setup" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 text-center">
            <Link href="/" className="mb-6 inline-flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <Heart className="h-6 w-6 fill-current" />
              </div>
              <span className="text-2xl font-bold tracking-tight">GEEZ</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Personal or dual savings — your choice
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account type */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType("personal")}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm transition ${
                  accountType === "personal"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card"
                }`}
              >
                <UserRound className="h-6 w-6" />
                <span className="font-semibold">Personal</span>
                <span className="text-[11px] text-muted-foreground">
                  Save on your own
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAccountType("dual")}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm transition ${
                  accountType === "dual"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card"
                }`}
              >
                <Users className="h-6 w-6" />
                <span className="font-semibold">Dual</span>
                <span className="text-[11px] text-muted-foreground">
                  Save with a partner
                </span>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-background py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
                  placeholder="Your name"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-background py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
                  placeholder="you@email.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-background py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
                  placeholder="e.g. 0991..."
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-background py-3 pl-10 pr-12 text-sm outline-none focus:border-primary"
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {accountType === "dual" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Partner invite code (optional)
                </label>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="Paste code if joining a partner"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Leave empty to create a dual vault and invite someone after signup.
                </p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Your referral username (optional)
              </label>
              <input
                value={referralUsername}
                onChange={(e) =>
                  setReferralUsername(e.target.value.replace(/\s/g, "").toLowerCase())
                }
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder="e.g. giftk"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Referred by (username)
              </label>
              <input
                value={referredByCode}
                onChange={(e) => setReferredByCode(e.target.value.toLowerCase())}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder="Friend's referral username"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary">
              Sign in
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
