"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Swords, Eye, EyeOff, Zap, AlertCircle, CheckCircle2, Mail } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");
  const emailChanged = searchParams.get("emailChanged");
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUnverified, setIsUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsUnverified(false);
    setResendMessage(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "EmailNotVerified" || result.error.includes("EmailNotVerified")) {
        setIsUnverified(true);
        setError("Please check your email to verify your account before signing in.");
      } else {
        setError("Invalid email or password");
      }
    } else {
      router.push("/dashboard");
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError("Please enter your email address above.");
      return;
    }

    setResending(true);
    setResendMessage(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setResending(false);

      if (!res.ok) {
        setResendMessage({
          text: data.error || "Failed to resend verification email.",
          type: "error",
        });
      } else {
        setResendMessage({
          text: "Verification link sent! Please check your inbox.",
          type: "success",
        });
      }
    } catch {
      setResending(false);
      setResendMessage({
        text: "Network error. Please try again.",
        type: "error",
      });
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="auth-card-forge w-full max-w-[440px] p-6 sm:p-8 rounded-2xl flex flex-col gap-6 relative z-10 transition-all duration-300">
      {/* Identity Header */}
      <div className="text-center flex flex-col gap-1.5">
        <h1 className="font-sora text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Welcome Back
        </h1>
        <p className="font-geist text-xs sm:text-sm font-semibold uppercase tracking-widest text-slate-400">
          Sign in to continue forging habits
        </p>
      </div>

      {/* Segmented Mode Toggle */}
      <div className="flex p-1 bg-slate-950/60 border border-slate-800 rounded-xl">
        <button
          type="button"
          className="flex-1 py-2 sm:py-2.5 font-geist text-xs sm:text-sm font-bold tracking-wide rounded-lg transition-all duration-200 bg-purple-600 text-white shadow-md"
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => router.push("/register")}
          className="flex-1 py-2 sm:py-2.5 font-geist text-xs sm:text-sm font-semibold tracking-wide text-slate-400 hover:text-white transition-all duration-200 rounded-lg hover:bg-slate-800/50"
        >
          Create Account
        </button>
      </div>

      {/* Success Banner from Email Verification */}
      {verified === "true" && (
        <div className="flex items-center gap-2.5 p-3 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="font-medium">Email verified — you can now sign in to your forge!</span>
        </div>
      )}

      {/* Success Banner from Email Change Confirmation */}
      {emailChanged === "true" && (
        <div className="flex items-center gap-2.5 p-3 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="font-medium">Email address updated successfully! Please sign in with your new email.</span>
        </div>
      )}

      {/* URL Error Banner from Invalid/Expired Token */}
      {urlError === "InvalidVerificationToken" && (
        <div className="flex items-center gap-2.5 p-3 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span className="font-medium">Verification link is invalid or has expired. Please register again or sign in.</span>
        </div>
      )}

      {/* URL Error Banner from Invalid/Expired Email Change Token */}
      {urlError === "InvalidEmailChangeToken" && (
        <div className="flex items-center gap-2.5 p-3 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span className="font-medium">Email change link is invalid or has expired. Please log in and request a new change from Settings.</span>
        </div>
      )}

      {/* Login Error Banner */}
      {error && (
        <div className="flex items-center gap-2.5 p-3 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Resend Verification Action Block */}
      {isUnverified && (
        <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs sm:text-sm animate-fadeIn">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-purple-400" />
              Need a new link?
            </span>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className="font-bold text-purple-400 hover:text-purple-300 transition underline underline-offset-4 disabled:opacity-50 cursor-pointer"
            >
              {resending ? "Sending..." : "Resend verification email"}
            </button>
          </div>
          {resendMessage && (
            <p
              className={`text-xs font-medium ${
                resendMessage.type === "success" ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {resendMessage.text}
            </p>
          )}
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="font-geist text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 px-1"
          >
            EMAIL ADDRESS
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-forge w-full h-11 sm:h-12 px-4 rounded-xl text-sm placeholder:text-slate-500"
            placeholder="user@anvil.com"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center px-1">
            <label
              htmlFor="password"
              className="font-geist text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400"
            >
              PASSWORD
            </label>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert("Password reset functionality is available via your workspace admin.");
              }}
              className="font-geist text-[11px] sm:text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
            >
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-forge w-full h-11 sm:h-12 pl-4 pr-11 rounded-xl text-sm placeholder:text-slate-500"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="molten-btn w-full h-12 sm:h-13 mt-2 rounded-xl font-sora text-sm sm:text-base font-bold text-white flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
        >
          <span>{loading ? "Signing in..." : "Sign in"}</span>
          <Zap className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:scale-110 group-hover:rotate-12" />
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-1">
        <div className="h-px flex-1 bg-slate-800" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          OR
        </span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      {/* Google OAuth Option */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full h-11 sm:h-12 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 text-white font-geist text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2.5"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
          />
          <path
            fill="#FBBC05"
            d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.6-1.5-1-3.2-1-5z"
          />
          <path
            fill="#34A853"
            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
          />
        </svg>
        Sign in with Google
      </button>

      {/* Footer Link */}
      <p className="text-center font-geist text-xs sm:text-sm text-slate-400 mt-1">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-bold text-purple-400 hover:text-purple-300 underline underline-offset-4"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-8 overflow-x-hidden font-geist" style={{ backgroundColor: "var(--bg-primary, #0c0e12)" }}>
      {/* Background Texture & Ambient Glow Blobs */}
      <div className="fixed inset-0 -z-10 texture-bg opacity-30 pointer-events-none" />
      <div className="fixed top-1/4 -left-20 w-80 sm:w-96 h-80 sm:h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 -right-20 w-80 sm:w-96 h-80 sm:h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Branding */}
      <header className="mb-6 sm:mb-8 flex items-center justify-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-teal-500 shadow-lg shadow-purple-900/30 group-hover:scale-105 transition-transform duration-200">
            <Swords className="h-5 w-5 sm:h-6 sm:w-6 text-white animate-pulse" />
          </div>
          <span className="font-sora text-xl sm:text-2xl font-black tracking-wider text-white">
            ANVIL
          </span>
        </Link>
      </header>

      {/* Auth Card wrapped in Suspense for useSearchParams */}
      <Suspense fallback={
        <div className="auth-card-forge w-full max-w-[440px] p-6 sm:p-8 rounded-2xl flex items-center justify-center text-slate-400">
          Loading...
        </div>
      }>
        <LoginForm />
      </Suspense>
    </main>
  );
}
