"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-8"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <h1
          className="mb-2 text-center text-3xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Welcome back
        </h1>
        <p
          className="mb-8 text-center text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Sign in to continue forging habits
        </p>

        {error && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "var(--danger)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-purple)" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div
            className="h-px flex-1"
            style={{ backgroundColor: "var(--border)" }}
          />
          <span
            className="text-xs uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            or
          </span>
          <div
            className="h-px flex-1"
            style={{ backgroundColor: "var(--border)" }}
          />
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-90"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            backgroundColor: "var(--bg-tertiary)",
          }}
        >
          Sign in with Google
        </button>

        <p
          className="mt-6 text-center text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            className="font-medium underline"
            style={{ color: "var(--accent-purple)" }}
          >
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
